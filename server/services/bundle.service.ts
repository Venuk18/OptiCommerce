import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';
import {
  GetBundleSuggestionsInput,
  BundleSuggestionsResponseData,
  BundleSuggestionItem,
} from '../types/bundle.types';
import {
  normalizeProductCategory,
  COMPLEMENTARY_RELATIONSHIP_MAP,
  STANDALONE_DEVICE_FAMILIES,
  ProductCategoryFamily,
  extractCleanTokens,
} from '../utils/bundleTaxonomy';

export class BundleService {
  /**
   * POST /api/cart/bundles - Deterministic Complementary Product Bundle / Cross-Sell Engine
   * Strictly 0 Gemini/AI calls.
   */
  async getBundleSuggestions(input: GetBundleSuggestionsInput): Promise<BundleSuggestionsResponseData> {
    const { sessionId, storeId, productId, limit = 3 } = input;

    // 1. Validation
    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }
    if (!productId || !productId.trim()) {
      throw new AppError('productId is required', 400);
    }

    const safeLimit = Math.max(1, Math.min(3, Number(limit) || 3));

    // 2. Verify Store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId.trim() },
    });
    if (!store) {
      throw new AppError(`Store '${storeId}' not found`, 404);
    }

    // 3. Verify Base Product exists and belongs to the requested store
    const baseProduct = await prisma.product.findUnique({
      where: { id: productId.trim() },
    });
    if (!baseProduct) {
      throw new AppError(`Product '${productId}' not found`, 404);
    }
    if (baseProduct.storeId !== store.id) {
      throw new AppError('Product does not belong to the requested store', 400);
    }

    // 4. Retrieve Customer's Current Cart for (sessionId, storeId) to exclude already added items
    const existingCart = await prisma.cart.findUnique({
      where: {
        sessionId_storeId: {
          sessionId: sessionId.trim(),
          storeId: store.id,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const cartProductIds = new Set<string>();
    const cartCategoryFamilies = new Set<ProductCategoryFamily>();

    if (existingCart && existingCart.items) {
      for (const item of existingCart.items) {
        cartProductIds.add(item.productId);
        if (item.product) {
          const family = normalizeProductCategory(item.product);
          cartCategoryFamilies.add(family);
        }
      }
    }

    // Cart exclusion: never recommend base product or items already in the customer's cart
    const excludedProductIds = [baseProduct.id, ...Array.from(cartProductIds)];

    // 5. Query candidate products from PostgreSQL with HARD candidate filtering
    const candidates = await prisma.product.findMany({
      where: {
        storeId: store.id,
        status: 'PUBLISHED',
        stock: { gt: 0 },
        id: {
          notIn: excludedProductIds,
        },
      },
    });

    if (candidates.length === 0) {
      return {
        baseProductId: baseProduct.id,
        suggestions: [],
      };
    }

    // 6. Base Product Normalization
    const baseFamily = normalizeProductCategory(baseProduct);
    const relationshipTargets = COMPLEMENTARY_RELATIONSHIP_MAP[baseFamily] || [];
    const relationMap = new Map<ProductCategoryFamily, { strength: number; defaultReason: string }>();

    for (const target of relationshipTargets) {
      relationMap.set(target.targetFamily, {
        strength: target.strength,
        defaultReason: target.defaultReason,
      });
    }

    const baseTags = Array.isArray(baseProduct.tags) ? baseProduct.tags.map(t => t.toLowerCase()) : [];
    const baseFeatures = Array.isArray(baseProduct.features) ? baseProduct.features.map(f => f.toLowerCase()) : [];
    const baseNameTokens = new Set(extractCleanTokens(baseProduct.name));
    const baseDescTokens = new Set(extractCleanTokens(baseProduct.description || ''));
    const baseBrand = (baseProduct.brand || '').toLowerCase().trim();

    // 7. Deterministic Scoring
    interface ScoredCandidate {
      candidate: typeof candidates[0];
      bundleScore: number;
      relationshipStrength: number;
      reason: string;
    }

    const scoredList: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      const candidateFamily = normalizeProductCategory(candidate);
      let relationshipStrength = 0;
      let reason = 'Complements your selection';

      // (A) Complementary Category Relationship (40% max -> 0 to 40 pts)
      let categoryScore = 0;

      // CRITICAL: Standalone devices of same family get 0 category relationship (e.g. Phone -> Phone = 0)
      if (baseFamily === candidateFamily && STANDALONE_DEVICE_FAMILIES.has(baseFamily)) {
        categoryScore = 0;
        relationshipStrength = 0;
      } else if (relationMap.has(candidateFamily)) {
        const relation = relationMap.get(candidateFamily)!;
        relationshipStrength = relation.strength;
        reason = relation.defaultReason;
        categoryScore = Math.round(40 * relationshipStrength); // 28 to 40 pts
      } else if (
        candidateFamily === ProductCategoryFamily.GENERIC_ACCESSORY ||
        candidateFamily === ProductCategoryFamily.CHARGER ||
        candidateFamily === ProductCategoryFamily.CHARGING_CABLE
      ) {
        relationshipStrength = 0.40;
        categoryScore = 16;
        reason = 'Useful complementary accessory for your device';
      } else {
        categoryScore = 0;
        relationshipStrength = 0;
      }

      // If candidate is a direct substitute/same standalone device or completely unrelated, skip or heavily demote
      if (categoryScore === 0) {
        // Not a complementary accessory
        continue;
      }

      // (B) Tag Compatibility (20% max -> 0 to 20 pts)
      let tagScore = 0;
      const candidateTags = Array.isArray(candidate.tags) ? candidate.tags.map(t => t.toLowerCase()) : [];
      if (baseTags.length > 0 && candidateTags.length > 0) {
        let matchingTags = 0;
        for (const ct of candidateTags) {
          if (baseTags.some(bt => bt.includes(ct) || ct.includes(bt))) {
            matchingTags++;
          }
        }
        tagScore = Math.min(20, matchingTags * 7);
      } else {
        tagScore = 5; // Baseline tag compatibility for matched categories
      }

      // (C) Feature Compatibility (10% max -> 0 to 10 pts)
      let featureScore = 0;
      const candidateFeatures = Array.isArray(candidate.features) ? candidate.features.map(f => f.toLowerCase()) : [];
      const combinedCandidateFeatureText = candidateFeatures.join(' ');
      const combinedBaseFeatureText = baseFeatures.join(' ');

      const compatibilitySignals = [
        'fast charging', 'usb-c', 'type-c', 'wireless', 'anc', 'gan', 'magsafe',
        'bluetooth', 'battery', 'protection', 'full-frame', '4k', 'ergonomic', 'cushion'
      ];

      for (const sig of compatibilitySignals) {
        if (combinedBaseFeatureText.includes(sig) && combinedCandidateFeatureText.includes(sig)) {
          featureScore += 4;
        }
      }
      featureScore = Math.min(10, featureScore);

      // (D) Name + Description Compatibility (10% max -> 0 to 10 pts)
      let nameDescScore = 0;
      const candidateNameTokens = extractCleanTokens(candidate.name);
      const candidateDescTokens = extractCleanTokens(candidate.description || '');

      let nameOverlapCount = 0;
      for (const t of candidateNameTokens) {
        if (baseNameTokens.has(t) || baseDescTokens.has(t)) {
          nameOverlapCount++;
        }
      }
      for (const t of candidateDescTokens) {
        if (baseNameTokens.has(t)) {
          nameOverlapCount++;
        }
      }
      nameDescScore = Math.min(10, nameOverlapCount * 3);

      // (E) Specification Compatibility (5% max -> 0 to 5 pts)
      let specScore = 0;
      if (
        (combinedBaseFeatureText.includes('usb-c') && combinedCandidateFeatureText.includes('usb-c')) ||
        (combinedBaseFeatureText.includes('wireless') && combinedCandidateFeatureText.includes('wireless'))
      ) {
        specScore = 5;
      }

      // (F) Brand Compatibility (5% max -> 0 to 5 pts)
      let brandScore = 0;
      const candidateBrand = (candidate.brand || '').toLowerCase().trim();
      if (baseBrand && candidateBrand && baseBrand === candidateBrand) {
        brandScore = 5;
      }

      // (G) Cart Context (10% max -> 0 to 10 pts)
      // If customer has NOT yet added this accessory family to cart, give +10
      let cartContextScore = 0;
      if (!cartCategoryFamilies.has(candidateFamily)) {
        cartContextScore = 10;
      } else {
        cartContextScore = 2; // Demote if they already have one in cart
      }

      // Calculate bounded total (0 - 100)
      const rawTotal = categoryScore + tagScore + featureScore + nameDescScore + specScore + brandScore + cartContextScore;
      const bundleScore = Math.max(10, Math.min(100, Math.round(rawTotal)));

      scoredList.push({
        candidate,
        bundleScore,
        relationshipStrength,
        reason,
      });
    }

    // 8. Result Ordering
    // 1. bundleScore DESC
    // 2. complementaryRelationshipStrength DESC
    // 3. price ASC
    // 4. stock DESC
    // 5. productId ASC
    scoredList.sort((a, b) => {
      if (b.bundleScore !== a.bundleScore) {
        return b.bundleScore - a.bundleScore;
      }
      if (b.relationshipStrength !== a.relationshipStrength) {
        return b.relationshipStrength - a.relationshipStrength;
      }
      const priceA = Number(a.candidate.price);
      const priceB = Number(b.candidate.price);
      if (priceA !== priceB) {
        return priceA - priceB;
      }
      if (b.candidate.stock !== a.candidate.stock) {
        return b.candidate.stock - a.candidate.stock;
      }
      return a.candidate.id.localeCompare(b.candidate.id);
    });

    // 9. Take top limit
    const topCandidates = scoredList.slice(0, safeLimit);

    // 10. Format customer-safe response (Strictly NEVER expose costPrice, margins, expectedProfit, purchaseProbability)
    const suggestions: BundleSuggestionItem[] = topCandidates.map((item) => {
      const prod = item.candidate;
      return {
        productId: prod.id,
        name: prod.name,
        category: prod.category,
        brand: prod.brand,
        price: Number(prod.price),
        stock: prod.stock,
        image: Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : '',
        reason: item.reason,
        bundleScore: item.bundleScore,
      };
    });

    return {
      baseProductId: baseProduct.id,
      suggestions,
    };
  }
}

export const bundleService = new BundleService();
