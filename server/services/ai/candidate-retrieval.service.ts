import { ProductStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/app.error';
import { CustomerIntent } from '../../types/intent.types';
import { CandidateProduct, SearchCandidatesResult } from '../../types/search.types';

const MAX_CANDIDATES_LIMIT = 10;

const GENERIC_STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'she', 'it',
  'they', 'what', 'which', 'who', 'this', 'that', 'these', 'those', 'am', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as',
  'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up',
  'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will',
  'just', 'don', 'should', 'now', 'need', 'want', 'looking', 'look', 'find',
  'buy', 'search', 'get', 'give', 'show', 'please', 'suggest', 'recommend',
  'budget', 'price', 'rupees', 'inr', 'rs', 'cost', 'under', 'below', 'less',
  'above', 'more', 'between', 'around', 'upto', 'maximum', 'minimum', 'max', 'min',
  'strong', 'good', 'best', 'great', 'nice', 'cheap', 'expensive', 'top', 'quality',
  'item', 'items', 'product', 'products', 'thing', 'things'
]);

export class CandidateRetrievalService {
  /**
   * Retrieves and ranks candidate products deterministically for a given store and customer intent.
   * ZERO Gemini calls are made in this service.
   */
  async retrieveCandidates(storeId: string, intent: CustomerIntent): Promise<SearchCandidatesResult> {
    // 1. Validate storeId
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }
    const cleanStoreId = storeId.trim();

    // 2. Validate CustomerIntent structure
    this.validateIntent(intent);

    // 3. Build Prisma where clause with hard filters
    const where: Prisma.ProductWhereInput = {
      storeId: cleanStoreId,
      status: ProductStatus.PUBLISHED,
      stock: {
        gt: 0,
      },
    };

    // Hard price filtering
    if (intent.maxPrice !== null && intent.maxPrice !== undefined) {
      where.price = {
        ...(where.price as Prisma.DecimalFilter || {}),
        lte: intent.maxPrice,
      };
    }

    if (intent.minPrice !== null && intent.minPrice !== undefined) {
      where.price = {
        ...(where.price as Prisma.DecimalFilter || {}),
        gte: intent.minPrice,
      };
    }

    // Hard category filtering (normalized / case-insensitive)
    if (intent.category && typeof intent.category === 'string' && intent.category.trim()) {
      const cat = intent.category.trim().toLowerCase();
      const singularCat = cat.endsWith('s') ? cat.slice(0, -1) : cat;
      const pluralCat = cat.endsWith('s') ? cat : `${cat}s`;

      where.OR = [
        { category: { equals: cat, mode: 'insensitive' } },
        { category: { equals: singularCat, mode: 'insensitive' } },
        { category: { equals: pluralCat, mode: 'insensitive' } },
        { category: { contains: singularCat, mode: 'insensitive' } },
        { name: { contains: singularCat, mode: 'insensitive' } },
        { tags: { has: cat } },
        { tags: { has: singularCat } },
      ];
    }

    // Hard brand filtering (normalized / case-insensitive)
    if (intent.brand && typeof intent.brand === 'string' && intent.brand.trim()) {
      const brandClean = intent.brand.trim();
      where.brand = {
        equals: brandClean,
        mode: 'insensitive',
      };
    }

    // 4. Query PostgreSQL catalog via Prisma
    const rawProducts = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        brand: true,
        price: true,
        stock: true,
        images: true,
        features: true,
        specifications: true,
        tags: true,
        storeId: true,
        status: true,
        // CRITICAL: costPrice is NOT selected to prevent any merchant-sensitive data exposure
      },
    });

    // 5. Score candidates deterministically
    const scoredCandidates: CandidateProduct[] = rawProducts.map((product) => {
      const score = this.calculateRelevanceScore(product, intent);
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        brand: product.brand,
        price: Number(product.price),
        stock: product.stock,
        images: product.images || [],
        features: product.features || [],
        specifications: (product.specifications as Record<string, any>) || null,
        tags: product.tags || [],
        relevanceScore: score,
      };
    });

    // 6. Sort by relevanceScore DESC, then price ASC, then id ASC
    scoredCandidates.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      if (a.price !== b.price) {
        return a.price - b.price;
      }
      return a.id.localeCompare(b.id);
    });

    // 7. Enforce maximum result limit
    const limitedCandidates = scoredCandidates.slice(0, MAX_CANDIDATES_LIMIT);

    return {
      products: limitedCandidates,
      count: limitedCandidates.length,
    };
  }

  /**
   * Calculates a deterministic relevance score using structured weights.
   */
  public calculateRelevanceScore(
    product: {
      name: string;
      description: string | null;
      category: string;
      brand: string | null;
      features: string[];
      specifications: any;
      tags: string[];
    },
    intent: CustomerIntent
  ): number {
    let score = 10; // Baseline score for matching hard filters

    const prodName = product.name.toLowerCase();
    const prodDesc = (product.description || '').toLowerCase();
    const prodCat = product.category.toLowerCase();
    const prodBrand = (product.brand || '').toLowerCase();
    const prodTags = (product.tags || []).map((t) => t.toLowerCase());
    const prodFeatures = (product.features || []).map((f) => f.toLowerCase());
    
    // Parse specifications text
    let prodSpecsText = '';
    if (product.specifications && typeof product.specifications === 'object') {
      try {
        prodSpecsText = Object.entries(product.specifications)
          .map(([k, v]) => `${k} ${v}`)
          .join(' ')
          .toLowerCase();
      } catch (e) {
        prodSpecsText = '';
      }
    }

    // 1. Category Matching (High Weight: +25 pts)
    if (intent.category) {
      const intentCat = intent.category.toLowerCase().trim();
      const singularCat = intentCat.endsWith('s') ? intentCat.slice(0, -1) : intentCat;
      if (prodCat === intentCat || prodCat.includes(singularCat)) {
        score += 25;
      } else if (prodName.includes(singularCat)) {
        score += 20;
      } else if (prodTags.some((t) => t.includes(singularCat))) {
        score += 15;
      }
    }

    // 2. Brand Matching (Weight: +20 pts)
    if (intent.brand) {
      const intentBrand = intent.brand.toLowerCase().trim();
      if (prodBrand === intentBrand) {
        score += 25;
      } else if (prodName.includes(intentBrand)) {
        score += 15;
      }
    }

    // 3. Multi-word Preferences Matching (High Weight)
    // Example: "strong bass", "good battery life", "active noise cancellation"
    for (const pref of intent.preferences || []) {
      const cleanPref = pref.toLowerCase().trim();
      if (!cleanPref) continue;

      let prefMatched = false;

      // Match in product name (+30 pts)
      if (prodName.includes(cleanPref)) {
        score += 30;
        prefMatched = true;
      }

      // Match in features (+20 pts)
      if (prodFeatures.some((f) => f.includes(cleanPref))) {
        score += 20;
        prefMatched = true;
      }

      // Match in tags (+18 pts)
      if (prodTags.some((t) => t.includes(cleanPref))) {
        score += 18;
        prefMatched = true;
      }

      // Match in description (+10 pts)
      if (prodDesc.includes(cleanPref)) {
        score += 10;
        prefMatched = true;
      }

      // Match in specifications (+8 pts)
      if (prodSpecsText.includes(cleanPref)) {
        score += 8;
        prefMatched = true;
      }

      // If full multi-word phrase didn't match directly, match individual domain keywords from preference
      if (!prefMatched) {
        const prefWords = cleanPref
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !GENERIC_STOP_WORDS.has(w));

        for (const word of prefWords) {
          if (prodName.includes(word)) score += 12;
          else if (prodFeatures.some((f) => f.includes(word))) score += 8;
          else if (prodTags.some((t) => t.includes(word))) score += 6;
          else if (prodDesc.includes(word)) score += 4;
          else if (prodSpecsText.includes(word)) score += 3;
        }
      }
    }

    // 4. Keyword Matching (Weighted by field prominence, ignoring generic stop words)
    for (const kw of intent.keywords || []) {
      const cleanKw = kw.toLowerCase().trim();
      if (!cleanKw || cleanKw.length < 2 || GENERIC_STOP_WORDS.has(cleanKw)) {
        continue;
      }

      // Exact token in Name (+20 pts)
      if (new RegExp(`\\b${cleanKw}\\b`, 'i').test(prodName) || prodName.includes(cleanKw)) {
        score += 20;
      }

      // In Category (+15 pts)
      if (prodCat.includes(cleanKw)) {
        score += 15;
      }

      // In Tags (+12 pts)
      if (prodTags.some((t) => t.includes(cleanKw))) {
        score += 12;
      }

      // In Features (+10 pts)
      if (prodFeatures.some((f) => f.includes(cleanKw))) {
        score += 10;
      }

      // In Brand (+8 pts)
      if (prodBrand.includes(cleanKw)) {
        score += 8;
      }

      // In Description (+6 pts)
      if (prodDesc.includes(cleanKw)) {
        score += 6;
      }

      // In Specifications (+4 pts)
      if (prodSpecsText.includes(cleanKw)) {
        score += 4;
      }
    }

    return score;
  }

  /**
   * Validates the input customer intent object.
   */
  private validateIntent(intent: any): void {
    if (!intent || typeof intent !== 'object') {
      throw new AppError('intent is required and must be an object', 400);
    }

    if (intent.category !== null && intent.category !== undefined && typeof intent.category !== 'string') {
      throw new AppError('intent.category must be a string or null', 400);
    }

    if (intent.brand !== null && intent.brand !== undefined && typeof intent.brand !== 'string') {
      throw new AppError('intent.brand must be a string or null', 400);
    }

    if (intent.minPrice !== null && intent.minPrice !== undefined) {
      if (typeof intent.minPrice !== 'number' || isNaN(intent.minPrice) || intent.minPrice < 0) {
        throw new AppError('intent.minPrice must be a non-negative number or null', 400);
      }
    }

    if (intent.maxPrice !== null && intent.maxPrice !== undefined) {
      if (typeof intent.maxPrice !== 'number' || isNaN(intent.maxPrice) || intent.maxPrice < 0) {
        throw new AppError('intent.maxPrice must be a non-negative number or null', 400);
      }
    }

    if (
      intent.minPrice !== null &&
      intent.minPrice !== undefined &&
      intent.maxPrice !== null &&
      intent.maxPrice !== undefined
    ) {
      if (intent.minPrice > intent.maxPrice) {
        throw new AppError('intent.minPrice cannot be greater than intent.maxPrice', 400);
      }
    }

    if (intent.preferences !== undefined && intent.preferences !== null && !Array.isArray(intent.preferences)) {
      throw new AppError('intent.preferences must be an array of strings', 400);
    }

    if (intent.keywords !== undefined && intent.keywords !== null && !Array.isArray(intent.keywords)) {
      throw new AppError('intent.keywords must be an array of strings', 400);
    }
  }
}

export const candidateRetrievalService = new CandidateRetrievalService();
