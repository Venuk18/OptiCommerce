import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/app.error';
import {
  RecoverSaleRequest,
  RecoverSaleResult,
  ProductAlternativeItem,
} from '../../types/revenue.types';

const MAX_SESSION_ID_LENGTH = 128;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;

// Weight distribution for deterministic multi-factor sale recovery scoring
// Balances Category (30%), Tag overlap (15%), Feature specs (15%), Customer Intent (15%),
// Value Recovery / Savings (20%), and Brand affinity (5%).
export const CATEGORY_WEIGHT = 0.30;
export const TAG_WEIGHT = 0.15;
export const FEATURE_WEIGHT = 0.15;
export const INTENT_WEIGHT = 0.15;
export const VALUE_RECOVERY_WEIGHT = 0.20;
export const BRAND_WEIGHT = 0.05;

export class SaleRecoveryService {
  /**
   * Discovers up to 3 (max 5) real, in-stock, published alternative products from the same store
   * when a customer rejects an offer on a product.
   *
   * STRICT ZERO GEMINI CALLS.
   * 100% Deterministic Mathematical Value Recovery & Intent Scoring.
   */
  async recoverSale(input: RecoverSaleRequest): Promise<RecoverSaleResult> {
    if (!input || typeof input !== 'object') {
      throw new AppError('Request body is required', 400);
    }

    const { sessionId, storeId, rejectedProductId, userQuery, maxBudget, limit } = input;

    // 1. Input Validation
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new AppError('sessionId is required and must be a non-empty string', 400);
    }
    const cleanSessionId = sessionId.trim();
    if (cleanSessionId.length > MAX_SESSION_ID_LENGTH) {
      throw new AppError(
        `sessionId exceeds maximum length of ${MAX_SESSION_ID_LENGTH} characters`,
        400
      );
    }

    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required and must be a non-empty string', 400);
    }
    const cleanStoreId = storeId.trim();

    if (!rejectedProductId || typeof rejectedProductId !== 'string' || !rejectedProductId.trim()) {
      throw new AppError('rejectedProductId is required and must be a non-empty string', 400);
    }
    const cleanRejectedId = rejectedProductId.trim();

    const maxResults = Math.min(
      Math.max(1, typeof limit === 'number' && !isNaN(limit) ? Math.floor(limit) : DEFAULT_LIMIT),
      MAX_LIMIT
    );

    // 2. Validate Store & Rejected Product
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    const rejectedProduct = await prisma.product.findUnique({
      where: { id: cleanRejectedId },
    });
    if (!rejectedProduct) {
      throw new AppError('Rejected product not found', 404);
    }

    if (rejectedProduct.storeId !== cleanStoreId) {
      throw new AppError('Rejected product does not belong to the specified store', 400);
    }

    const rejectedPrice = Number(rejectedProduct.price);
    const rejectedCategory = (rejectedProduct.category || '').trim().toLowerCase();
    const rejectedBrand = (rejectedProduct.brand || '').trim().toLowerCase();
    const rejectedTags = new Set(
      (rejectedProduct.tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    );
    const rejectedFeatures = (rejectedProduct.features || []).map((f) => String(f).trim().toLowerCase());

    // 3. Extract customer search/intent keywords if provided or inferred from session events
    let intentKeywords: string[] = [];
    if (userQuery && typeof userQuery === 'string' && userQuery.trim().length > 0) {
      intentKeywords = this.tokenizeText(userQuery);
    } else {
      // Look back at recent SEARCH and PRODUCT_VIEW events for this session in this store
      try {
        const recentEvents = await prisma.commerceEvent.findMany({
          where: {
            sessionId: cleanSessionId,
            storeId: cleanStoreId,
            eventType: {
              in: ['SEARCH', 'PRODUCT_VIEW'],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        for (const evt of recentEvents) {
          if (evt.metadata && typeof evt.metadata === 'object') {
            const meta = evt.metadata as Record<string, any>;
            if (meta.query && typeof meta.query === 'string') {
              intentKeywords.push(...this.tokenizeText(meta.query));
            }
            if (meta.category && typeof meta.category === 'string') {
              intentKeywords.push(...this.tokenizeText(meta.category));
            }
          }
        }
      } catch (e) {
        // Non-blocking fallback
      }
    }
    const uniqueIntentKeywords = Array.from(new Set(intentKeywords));

    // 4. Query candidate products from Database
    // STRICT CANDIDATE FILTERING RULES:
    // - Same store (storeId = cleanStoreId)
    // - Exclude the rejected product (id != cleanRejectedId)
    // - PUBLISHED status or LOW_STOCK (must be active for sale)
    // - Exclude DRAFT, OUT_OF_STOCK, ARCHIVED
    // - In stock (stock > 0)
    const candidates = await prisma.product.findMany({
      where: {
        storeId: cleanStoreId,
        id: { not: cleanRejectedId },
        status: {
          in: [ProductStatus.PUBLISHED, ProductStatus.LOW_STOCK],
        },
        stock: {
          gt: 0,
        },
      },
    });

    if (candidates.length === 0) {
      return {
        rejectedProductId: rejectedProduct.id,
        rejectedProductName: rejectedProduct.name,
        rejectedProductPrice: rejectedPrice,
        alternatives: [],
        totalFound: 0,
      };
    }

    // 5. Deterministic Scoring Pipeline for Each Candidate
    const scoredCandidates: Array<{
      product: typeof candidates[0];
      recoveryScore: number;
      priceDifference: number;
      priceComparison: 'cheaper' | 'similar' | 'premium';
      matchHighlights: string[];
    }> = [];

    for (const cand of candidates) {
      const candPrice = Number(cand.price);
      if (isNaN(candPrice) || candPrice <= 0) continue;

      // Strict budget filter: candidate price must strictly not exceed explicit customer maxBudget
      if (typeof maxBudget === 'number' && maxBudget > 0 && candPrice > maxBudget) {
        continue;
      }

      const candCategory = (cand.category || '').trim().toLowerCase();
      const candBrand = (cand.brand || '').trim().toLowerCase();
      const candTags = new Set(
        (cand.tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      );
      const candFeatures = (cand.features || []).map((f) => String(f).trim().toLowerCase());
      const matchHighlights: string[] = [];

      // A. Category Similarity (30%)
      let categoryScore = 0;
      if (candCategory === rejectedCategory) {
        categoryScore = 1.0;
        matchHighlights.push(`Same ${cand.category} category`);
      } else if (
        candCategory.includes(rejectedCategory) ||
        rejectedCategory.includes(candCategory)
      ) {
        categoryScore = 0.7;
      }

      // B. Tag Jaccard Similarity (15%)
      let tagScore = 0;
      if (rejectedTags.size > 0 && candTags.size > 0) {
        let intersectionCount = 0;
        const matchingTags: string[] = [];
        for (const tag of candTags) {
          if (rejectedTags.has(tag)) {
            intersectionCount++;
            matchingTags.push(tag);
          }
        }
        const unionSize = new Set([...rejectedTags, ...candTags]).size;
        tagScore = unionSize > 0 ? intersectionCount / unionSize : 0;
        if (matchingTags.length > 0) {
          matchHighlights.push(`Matches tags: ${matchingTags.slice(0, 2).join(', ')}`);
        }
      }

      // C. Feature Overlap / Keyword Match (15%)
      let featureScore = 0;
      if (rejectedFeatures.length > 0 && candFeatures.length > 0) {
        const rejectedTokens = this.tokenizeArray(rejectedFeatures);
        const candTokens = this.tokenizeArray(candFeatures);
        const overlap = candTokens.filter((tok) => rejectedTokens.includes(tok));
        featureScore = Math.min(1.0, overlap.length / Math.max(3, rejectedTokens.length));
        if (overlap.length > 0) {
          matchHighlights.push(`Shared specs: ${overlap.slice(0, 2).join(', ')}`);
        }
      }

      // D. Customer Intent Alignment (15%)
      // Strongly matches customer explicit query/needs (e.g., "wireless", "bass", "earbuds")
      let intentScore = 0;
      if (uniqueIntentKeywords.length > 0) {
        const candFullText = `${cand.name} ${cand.description || ''} ${cand.category} ${(cand.tags || []).join(' ')} ${(cand.features || []).join(' ')}`.toLowerCase();
        let matchedIntentCount = 0;
        for (const kw of uniqueIntentKeywords) {
          if (candFullText.includes(kw) || (kw === 'earbuds' && candFullText.includes('headphone'))) {
            matchedIntentCount++;
          }
        }
        intentScore = Math.min(1.0, matchedIntentCount / uniqueIntentKeywords.length);
        if (matchedIntentCount > 0) {
          matchHighlights.push(`Direct intent match (${matchedIntentCount}/${uniqueIntentKeywords.length} keywords)`);
        }
      } else {
        // Fallback to average of category and tags when no explicit query exists
        intentScore = (categoryScore + tagScore) / 2;
      }

      // E. Value Recovery Score (20%)
      // Directly addresses the offer rejection objection by rewarding meaningful positive savings
      // relative to the rejected product price, while preserving reasonable budget boundaries.
      let valueRecoveryScore = 0;
      const savings = rejectedPrice - candPrice;
      const savingsRatio = savings / Math.max(1, rejectedPrice);

      if (savingsRatio > 0) {
        // Positive savings: baseline 0.40 + scaled boost up to 1.0 for 5% to 35% savings
        // e.g., 16% savings yields 0.40 + 0.40 = 0.80
        // e.g., 22% savings yields 0.40 + 0.55 = 0.95
        valueRecoveryScore = Math.min(1.0, 0.40 + savingsRatio * 2.5);
        matchHighlights.push(`More accessible price (Save ₹${savings.toFixed(0)})`);
      } else if (savingsRatio === 0) {
        // Exact same price (e.g. cosmetic variant): 0.20 score (no savings offered to overcome rejected price point)
        valueRecoveryScore = 0.20;
      } else {
        // Higher price: penalized down to 0.05 for more expensive products
        const priceIncreaseRatio = Math.abs(savingsRatio);
        valueRecoveryScore = Math.max(0.05, 0.20 - priceIncreaseRatio * 1.5);
      }

      // F. Brand Affinity (5%)
      let brandScore = 0;
      if (rejectedBrand && candBrand && rejectedBrand === candBrand) {
        brandScore = 1.0;
        matchHighlights.push(`By ${cand.brand}`);
      }

      // Weighted Composite Recovery Score in [0.0, 1.0]
      const rawRecoveryScore =
        categoryScore * CATEGORY_WEIGHT +
        tagScore * TAG_WEIGHT +
        featureScore * FEATURE_WEIGHT +
        intentScore * INTENT_WEIGHT +
        valueRecoveryScore * VALUE_RECOVERY_WEIGHT +
        brandScore * BRAND_WEIGHT;

      const finalRecoveryScore = Number(Math.min(1.0, Math.max(0.01, rawRecoveryScore)).toFixed(4));
      const priceDifference = Number((candPrice - rejectedPrice).toFixed(2));
      
      let priceComparison: 'cheaper' | 'similar' | 'premium';
      if (priceDifference < -50) {
        priceComparison = 'cheaper';
      } else if (priceDifference > 50) {
        priceComparison = 'premium';
      } else {
        priceComparison = 'similar';
      }

      scoredCandidates.push({
        product: cand,
        recoveryScore: finalRecoveryScore,
        priceDifference,
        priceComparison,
        matchHighlights: matchHighlights.slice(0, 3),
      });
    }

    // 6. Recovery-First Result Ordering:
    // 1. recoveryScore DESC
    // 2. savings DESC (prefer larger savings when recovery score is within 0.001)
    // 3. price ASC (prefer lower price)
    // 4. stock DESC (prefer deeper inventory)
    // 5. id ASC (deterministic fallback)
    scoredCandidates.sort((a, b) => {
      if (Math.abs(b.recoveryScore - a.recoveryScore) > 0.001) {
        return b.recoveryScore - a.recoveryScore;
      }
      const savingsA = rejectedPrice - Number(a.product.price);
      const savingsB = rejectedPrice - Number(b.product.price);
      if (Math.abs(savingsB - savingsA) > 1) {
        return savingsB - savingsA;
      }
      const priceA = Number(a.product.price);
      const priceB = Number(b.product.price);
      if (Math.abs(priceA - priceB) > 1) {
        return priceA - priceB;
      }
      if (b.product.stock !== a.product.stock) {
        return b.product.stock - a.product.stock;
      }
      return a.product.id.localeCompare(b.product.id);
    });

    const topAlternatives = scoredCandidates.slice(0, maxResults);

    // 7. Format Customer-Safe Result (Zero Merchant Economics Leaked)
    const formattedAlternatives: ProductAlternativeItem[] = topAlternatives.map((item) => {
      const p = item.product;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        brand: p.brand,
        price: Number(p.price),
        stock: p.stock,
        images: p.images || [],
        features: p.features || [],
        tags: p.tags || [],
        status: p.status,
        similarityScore: item.recoveryScore,
        matchHighlights: item.matchHighlights,
        priceDifference: item.priceDifference,
        priceComparison: item.priceComparison,
      };
    });

    return {
      rejectedProductId: rejectedProduct.id,
      rejectedProductName: rejectedProduct.name,
      rejectedProductPrice: rejectedPrice,
      alternatives: formattedAlternatives,
      totalFound: formattedAlternatives.length,
    };
  }

  private tokenizeText(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  }

  private tokenizeArray(arr: string[]): string[] {
    const tokens: string[] = [];
    for (const item of arr) {
      tokens.push(...this.tokenizeText(item));
    }
    return Array.from(new Set(tokens));
  }
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'under', 'need', 'want', 'looking',
  'that', 'this', 'have', 'from', 'best', 'good', 'some', 'more',
  'what', 'which', 'will', 'show', 'find'
]);

export const saleRecoveryService = new SaleRecoveryService();
