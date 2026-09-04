import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';
import {
  GetBundleSuggestionsInput,
  BundleSuggestionsResponseData,
  BundleSuggestionItem,
  GetCartCrossSellInput,
  CartCrossSellResult,
  BundleOpportunity,
} from '../types/bundle.types';
import {
  normalizeProductCategory,
  COMPLEMENTARY_RELATIONSHIP_MAP,
  STANDALONE_DEVICE_FAMILIES,
  ProductCategoryFamily,
  extractCleanTokens,
} from '../utils/bundleTaxonomy';
import { aiProviderOrchestrator } from './ai/providers/ai-provider.orchestrator';

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

  /**
   * POST /api/cart/cross-sell - Cart-Aware Cross-Sell & Intelligent Bundling Engine (Phase 6)
   *
   * Customer Intent + Current Cart + Product Relationship
   * -> Genuinely useful complementary recommendations (Max 3)
   * -> Server-authoritative bundle opportunity with strict margin floor validation
   * -> Store isolation, duplicate suppression, and deterministic fallback.
   */
  async getCartCrossSell(input: GetCartCrossSellInput): Promise<CartCrossSellResult> {
    const { sessionId, storeId, focusedProductId, query, conversationState, limit = 3, suppressDuplicates = false } = input;

    // 1. Validation
    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const safeLimit = Math.max(1, Math.min(3, Number(limit) || 3));

    // 2. Verify Store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId.trim() },
    });
    if (!store) {
      throw new AppError(`Store '${storeId}' not found`, 404);
    }

    // 3. Retrieve Authoritative Cart for (sessionId, storeId) from Database
    const cart = await prisma.cart.findUnique({
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
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // 4. Extract Cart Items & Products
    const cartItems = (cart?.items || []).filter((item) => item.product);
    const cartProducts = cartItems.map((item) => item.product);
    const cartProductIds = new Set<string>(cartProducts.map((p) => p.id));
    const cartCategoryFamilies = new Set<ProductCategoryFamily>(
      cartProducts.map((p) => normalizeProductCategory(p))
    );

    // If both cart and focusedProductId are empty, return empty result
    if (cartProducts.length === 0 && !focusedProductId) {
      return {
        hasCartItems: false,
        cartStateHash: '',
        baseProducts: [],
        suggestions: [],
        bundleOpportunity: null,
        explanation: 'Your cart is currently empty. Add an item to view complementary recommendations.',
      };
    }

    // Compute cart state hash for duplicate suppression
    const cartStateHash = cartItems
      .map((i) => `${i.productId}:${i.quantity}`)
      .sort()
      .join('|');

    // 5. Determine the Primary Anchor / Base Product
    // Priority:
    // (a) focusedProductId if specified and valid in this store
    // (b) Standalone device family item in cart (e.g. LAPTOP, PHONE, CAMERA, TABLET, GAMING_CONSOLE)
    // (c) Highest-priced item in cart
    let baseProduct: typeof cartProducts[0] | null = null;

    if (focusedProductId) {
      const matchInCart = cartProducts.find((p) => p.id === focusedProductId);
      if (matchInCart) {
        baseProduct = matchInCart;
      } else {
        const directProd = await prisma.product.findUnique({
          where: { id: focusedProductId },
        });
        if (directProd && directProd.storeId === store.id) {
          baseProduct = directProd;
        }
      }
    }

    if (!baseProduct && cartProducts.length > 0) {
      const standaloneInCart = cartProducts.filter((p) => {
        const fam = normalizeProductCategory(p);
        return STANDALONE_DEVICE_FAMILIES.has(fam);
      });

      if (standaloneInCart.length > 0) {
        // Pick the highest-priced standalone device
        standaloneInCart.sort((a, b) => Number(b.price) - Number(a.price));
        baseProduct = standaloneInCart[0];
      } else {
        // Pick the highest-priced product in cart
        const sortedByPrice = [...cartProducts].sort((a, b) => Number(b.price) - Number(a.price));
        baseProduct = sortedByPrice[0];
      }
    }

    if (!baseProduct) {
      return {
        hasCartItems: cartProducts.length > 0,
        cartStateHash: '',
        baseProducts: [],
        suggestions: [],
        bundleOpportunity: null,
        explanation: 'No product could be identified to find complementary items.',
      };
    }

    const otherCartProducts = cartProducts.filter((p) => p.id !== baseProduct!.id);
    const baseProducts = [
      {
        id: baseProduct.id,
        name: baseProduct.name,
        category: baseProduct.category,
      },
      ...otherCartProducts.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
      })),
    ];

    // 6. Complementary Relationship Map Lookup
    const baseFamily = normalizeProductCategory(baseProduct);
    const relationshipTargets = COMPLEMENTARY_RELATIONSHIP_MAP[baseFamily] || [];
    const relationMap = new Map<ProductCategoryFamily, { strength: number; defaultReason: string }>();

    for (const target of relationshipTargets) {
      relationMap.set(target.targetFamily, {
        strength: target.strength,
        defaultReason: target.defaultReason,
      });
    }

    // 7. Query Candidate Products with HARD Database Filters
    // - Store isolation: storeId === store.id
    // - Published status only
    // - Stock > 0 (in-stock only)
    // - Exclude products already in customer's cart AND the anchor base product
    const excludedIds = Array.from(
      new Set([...cartProductIds, ...(baseProduct ? [baseProduct.id] : [])])
    );

    const candidates = await prisma.product.findMany({
      where: {
        storeId: store.id,
        status: 'PUBLISHED',
        stock: { gt: 0 },
        id: {
          notIn: excludedIds,
        },
      },
    });

    if (candidates.length === 0) {
      return {
        hasCartItems: true,
        cartStateHash,
        baseProducts,
        suggestions: [],
        bundleOpportunity: null,
        explanation: `No complementary accessories available in ${store.name} for your current cart items.`,
      };
    }

    // 8. Customer Context, Exclusions, Budget, and Preferences (Phases 1-4 State)
    const rejectedProductIds = new Set<string>(conversationState?.rejectedProducts || []);
    const exclusions = (conversationState?.exclusions || []).map((e: string) => e.toLowerCase().trim());
    const preferences = (conversationState?.preferences || []).map((p: string) => p.toLowerCase().trim());
    const maxBudget = conversationState?.budget?.max;
    const isTightBudget =
      Boolean(maxBudget !== null && maxBudget !== undefined) ||
      /\b(budget|cheaper|cheap|affordable|low\s+cost|tight\s+budget)\b/i.test(query || '');

    const baseTags = Array.isArray(baseProduct.tags) ? baseProduct.tags.map((t) => t.toLowerCase()) : [];
    const baseFeatures = Array.isArray(baseProduct.features) ? baseProduct.features.map((f) => f.toLowerCase()) : [];
    const baseNameTokens = new Set(extractCleanTokens(baseProduct.name));
    const baseDescTokens = new Set(extractCleanTokens(baseProduct.description || ''));
    const baseBrand = (baseProduct.brand || '').toLowerCase().trim();

    // 9. Deterministic Scoring Loop
    interface ScoredCandidate {
      candidate: typeof candidates[0];
      bundleScore: number;
      relationshipStrength: number;
      reason: string;
    }

    const scoredList: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      // Respect Exclusions: rejected product IDs or excluded brands/terms
      if (rejectedProductIds.has(candidate.id)) {
        continue;
      }

      const candidateBrand = (candidate.brand || '').toLowerCase().trim();
      const candidateNameLower = candidate.name.toLowerCase();

      if (
        exclusions.some((ex) => candidateBrand.includes(ex) || candidateNameLower.includes(ex))
      ) {
        continue;
      }

      const candidateFamily = normalizeProductCategory(candidate);
      let relationshipStrength = 0;
      let reason = 'Complements your cart';

      // (A) Category Relationship Scoring (40% max -> 0 to 40 pts)
      let categoryScore = 0;

      // Standalone devices of same family get 0 category relationship (e.g. Laptop -> Laptop = 0)
      if (baseFamily === candidateFamily && STANDALONE_DEVICE_FAMILIES.has(baseFamily)) {
        categoryScore = 0;
        relationshipStrength = 0;
      } else if (relationMap.has(candidateFamily)) {
        const relation = relationMap.get(candidateFamily)!;
        relationshipStrength = relation.strength;
        reason = relation.defaultReason;
        categoryScore = Math.round(40 * relationshipStrength);
      } else if (
        candidateFamily === ProductCategoryFamily.GENERIC_ACCESSORY ||
        candidateFamily === ProductCategoryFamily.CHARGER ||
        candidateFamily === ProductCategoryFamily.CHARGING_CABLE
      ) {
        relationshipStrength = 0.4;
        categoryScore = 16;
        reason = 'Useful complementary accessory for your device';
      } else {
        categoryScore = 0;
        relationshipStrength = 0;
      }

      // If not a complementary category, discard
      if (categoryScore === 0) {
        continue;
      }

      // (B) Tag Compatibility (15% max -> 0 to 15 pts)
      let tagScore = 0;
      const candidateTags = Array.isArray(candidate.tags) ? candidate.tags.map((t) => t.toLowerCase()) : [];
      if (baseTags.length > 0 && candidateTags.length > 0) {
        let matchingTags = 0;
        for (const ct of candidateTags) {
          if (baseTags.some((bt) => bt.includes(ct) || ct.includes(bt))) {
            matchingTags++;
          }
        }
        tagScore = Math.min(15, matchingTags * 5);
      } else {
        tagScore = 4;
      }

      // (C) Feature Compatibility (10% max -> 0 to 10 pts)
      let featureScore = 0;
      const candidateFeatures = Array.isArray(candidate.features)
        ? candidate.features.map((f) => f.toLowerCase())
        : [];
      const combinedCandidateFeatureText = candidateFeatures.join(' ');
      const combinedBaseFeatureText = baseFeatures.join(' ');

      const compatibilitySignals = [
        'fast charging',
        'usb-c',
        'type-c',
        'wireless',
        'anc',
        'gan',
        'magsafe',
        'bluetooth',
        'battery',
        'protection',
        'ergonomic',
        'cushion',
        'mechanical',
      ];

      for (const sig of compatibilitySignals) {
        if (combinedBaseFeatureText.includes(sig) && combinedCandidateFeatureText.includes(sig)) {
          featureScore += 3;
        }
      }
      featureScore = Math.min(10, featureScore);

      // (D) Name & Description Compatibility (10% max -> 0 to 10 pts)
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

      // (E) Brand Affinity (5% max -> 0 to 5 pts)
      let brandScore = 0;
      if (baseBrand && candidateBrand && baseBrand === candidateBrand) {
        brandScore = 5;
      }

      // (F) Cart Context (10% max -> 0 to 10 pts)
      // If customer has NOT yet added this family to cart, give +10
      let cartContextScore = 0;
      if (!cartCategoryFamilies.has(candidateFamily)) {
        cartContextScore = 10;
      } else {
        cartContextScore = 2; // Demote if they already have one in cart
      }

      // (G) Customer Preferences Alignment (10% max -> 0 to 10 pts)
      let preferenceScore = 0;
      if (preferences.length > 0) {
        const fullCandidateText = `${candidate.name} ${candidate.description || ''} ${candidateTags.join(' ')} ${combinedCandidateFeatureText}`.toLowerCase();
        for (const pref of preferences) {
          if (fullCandidateText.includes(pref)) {
            preferenceScore += 5;
          }
        }
        preferenceScore = Math.min(10, preferenceScore);
      }

      // (H) Budget & Price Sensitivity (10% max -> 0 to 10 pts)
      let budgetScore = 0;
      const candPrice = Number(candidate.price);
      if (isTightBudget) {
        // Lower price accessory receives higher score
        if (candPrice <= 2000) {
          budgetScore = 10;
        } else if (candPrice <= 5000) {
          budgetScore = 6;
        } else {
          budgetScore = 2;
        }
      } else {
        budgetScore = 5;
      }

      // Calculate bounded total (10 - 100)
      const rawTotal =
        categoryScore +
        tagScore +
        featureScore +
        nameDescScore +
        brandScore +
        cartContextScore +
        preferenceScore +
        budgetScore;
      const bundleScore = Math.max(10, Math.min(100, Math.round(rawTotal)));

      scoredList.push({
        candidate,
        bundleScore,
        relationshipStrength,
        reason,
      });
    }

    // 10. Result Ordering
    // 1. bundleScore DESC
    // 2. relationshipStrength DESC
    // 3. price ASC (cheaper first for accessories)
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

    // 11. Limit: MAXIMUM 3 complementary products. Never pad the result.
    const topCandidates = scoredList.slice(0, safeLimit);

    // 12. Format Customer-Safe Suggestions
    // (Strictly NEVER expose costPrice, margins, expectedProfit, purchaseProbability)
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

    // 13. Server-Authoritative Bundle Opportunity Calculation
    let bundleOpportunity: BundleOpportunity | null = null;

    if (topCandidates.length >= 1) {
      const suggestedProds = topCandidates.map((c) => c.candidate);
      const allBundleProducts = [baseProduct, ...suggestedProds];

      const originalTotal = allBundleProducts.reduce((sum, p) => sum + Number(p.price), 0);
      const totalCostPrice = allBundleProducts.reduce((sum, p) => sum + Number(p.costPrice || 0), 0);

      // Discount eligibility check:
      // Products must be aiDiscountEligible and positive margin headroom must exist
      const allDiscountEligible = allBundleProducts.every((p) => p.aiDiscountEligible === true);

      let discountEligible = false;
      let discountPercent = 0;
      let bundlePrice = originalTotal;
      let savings = 0;

      if (allDiscountEligible && totalCostPrice > 0) {
        // Standard bundle discount: 10%
        const candidateDiscountPercent = 10;
        const candidateDiscountedPrice = Math.round(originalTotal * (1 - candidateDiscountPercent / 100));

        // Margin Safety Rule: discounted bundle price must NEVER drop below total cost price
        if (candidateDiscountedPrice > totalCostPrice) {
          discountEligible = true;
          discountPercent = candidateDiscountPercent;
          bundlePrice = candidateDiscountedPrice;
          savings = originalTotal - candidateDiscountedPrice;
        }
      }

      bundleOpportunity = {
        bundleId: `bundle-${baseProduct.id}-${suggestedProds.map((p) => p.id).join('-')}`,
        bundleName: `${baseProduct.name} + Complete Setup`,
        products: allBundleProducts.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          brand: p.brand,
          price: Number(p.price),
          stock: p.stock,
          image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '',
        })),
        discountEligible,
        bundleSummary: discountEligible
          ? `Bundle & save ₹${savings.toLocaleString('en-IN')} (${discountPercent}% off) on this complete setup.`
          : `Complete your setup with these perfectly matched accessories.`,
        originalTotal,
        bundlePrice,
        savings,
        discountPercent: discountEligible ? discountPercent : 0,
      };
    }

    // 14. Conversational Explanation with Deterministic Fallback
    const complementNames = suggestions.map((s) => s.name);
    let explanation =
      complementNames.length > 0
        ? `Since you're getting ${baseProduct.name}, a ${complementNames.slice(0, 2).join(' and ')} could complete your setup. Want me to show you the best options?`
        : `Here are complementary products for your cart.`;

    // Attempt AI conversational polish if enabled and not in deterministic mode
    if (
      query &&
      suggestions.length > 0 &&
      aiProviderOrchestrator.getMode() !== 'deterministic'
    ) {
      try {
        const prompt = `You are a helpful e-commerce assistant.
Customer query: "${query}"
Customer cart base product: "${baseProduct.name}" (Price: ₹${baseProduct.price})
Recommended complementary accessories: ${suggestions.map((s) => `${s.name} (₹${s.price})`).join(', ')}
${bundleOpportunity?.discountEligible ? `Authorized bundle discount: ₹${bundleOpportunity.savings} savings (${bundleOpportunity.discountPercent}% off)` : 'No bundle discount authorized'}

Instructions:
- Write ONE concise, natural conversational sentence (max 30 words) explaining why these accessories complement the base product.
- Do NOT invent product names, prices, or discounts.
- Be helpful and friendly.
- Format response as valid JSON: {"explanation": "your single sentence here"}`;

        const aiResponse = await aiProviderOrchestrator.generateJson<{ explanation: string }>(prompt, {
          operationName: 'cart-cross-sell-explanation',
          temperature: 0.3,
        });

        if (aiResponse?.data?.explanation && aiResponse.data.explanation.trim().length > 10) {
          explanation = aiResponse.data.explanation.trim();
        }
      } catch {
        // Fallback safely to deterministic explanation
      }
    }

    return {
      hasCartItems: cartProducts.length > 0,
      cartStateHash,
      baseProducts,
      suggestions,
      bundleOpportunity,
      explanation,
    };
  }
}

export const bundleService = new BundleService();

