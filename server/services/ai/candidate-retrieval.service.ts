import { ProductStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/app.error';
import { CustomerIntent } from '../../types/intent.types';
import { CandidateProduct, SearchCandidatesResult } from '../../types/search.types';

export const RELEVANCE_MIN_THRESHOLD = 30;
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

// Primary device categories that must never match accessories unless the user explicitly requested accessories
const PRIMARY_DEVICE_CATEGORIES = new Set([
  'earbuds', 'headphones', 'earphones', 'laptops', 'laptop', 'cameras', 'camera',
  'smartphones', 'smartphone', 'phones', 'phone', 'mobile', 'monitors', 'monitor',
  'smartwatches', 'smartwatch'
]);

const ACCESSORY_KEYWORDS = [
  'case', 'sleeve', 'cover', 'protector', 'tempered glass', 'guard',
  'charger', 'hub', 'dock', 'mouse', 'adapter', 'cable', 'bag'
];

/**
 * Checks if a catalog product is an accessory rather than a standalone primary device.
 */
export function isAccessoryProduct(product: { name: string; category?: string | null; tags?: string[] | null }): boolean {
  const cat = (product.category || '').toLowerCase().trim();
  if (cat === 'accessories') return true;

  const name = (product.name || '').toLowerCase();
  const tags = (product.tags || []).map((t) => t.toLowerCase());

  if (ACCESSORY_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(name))) {
    return true;
  }
  if (tags.some((t) => ACCESSORY_KEYWORDS.some((kw) => t.includes(kw)))) {
    return true;
  }
  return false;
}

/**
 * Determines whether the customer's intent specifically asks for an accessory.
 */
export function queryRequestsAccessory(intent: CustomerIntent): boolean {
  const cat = (intent.category || '').toLowerCase().trim();
  const kwList = (intent.keywords || []).map((k) => k.toLowerCase().trim());
  const prefList = (intent.preferences || []).map((p) => p.toLowerCase().trim());
  const allTokens = [cat, ...kwList, ...prefList].join(' ');

  const accessorySearchTerms = [
    'case', 'cases', 'sleeve', 'sleeves', 'cover', 'covers', 'protector',
    'screen protector', 'tempered glass', 'guard', 'charger', 'chargers',
    'charging', 'gan', 'power adapter', 'hub', 'hubs', 'dock', 'docking station',
    'mouse', 'mice', 'trackpad', 'cable', 'cables', 'bag', 'laptop bag',
    'accessory', 'accessories'
  ];

  return accessorySearchTerms.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(allTokens));
}

/**
 * Checks whether the intent is a generic/broad browse request.
 */
export function isGenericBrowseIntent(intent: CustomerIntent): boolean {
  if (intent.category && intent.category.trim()) {
    const c = intent.category.toLowerCase().trim();
    if (!['all', 'general', 'products', 'items', 'store', 'shop'].includes(c)) {
      return false;
    }
  }
  if (intent.brand && intent.brand.trim()) {
    return false;
  }
  const substantiveKeywords = (intent.keywords || []).filter(
    (kw) => !GENERIC_STOP_WORDS.has(kw.toLowerCase().trim())
  );
  if (substantiveKeywords.length > 0) {
    return false;
  }
  if (intent.preferences && intent.preferences.length > 0) {
    return false;
  }
  return true;
}

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

    const isGeneric = isGenericBrowseIntent(intent);
    const userWantsAccessory = queryRequestsAccessory(intent);
    const intentCategoryLower = (intent.category || '').toLowerCase().trim();
    const isPrimaryCategory = PRIMARY_DEVICE_CATEGORIES.has(intentCategoryLower);

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

    // Disciplined category filtering (strictly separate primary categories from accessories)
    if (!isGeneric && intent.category && typeof intent.category === 'string' && intent.category.trim()) {
      const cat = intent.category.trim().toLowerCase();
      const singularCat = cat.endsWith('s') ? cat.slice(0, -1) : cat;
      const pluralCat = cat.endsWith('s') ? cat : `${cat}s`;

      const CATEGORY_SYNONYMS: Record<string, string[]> = {
        earbuds: ['earbuds', 'earbud', 'earphones', 'earphone', 'tws', 'true wireless', 'in-ear', 'pods', 'zenpods'],
        headphones: ['headphones', 'headphone', 'headset', 'over-ear', 'on-ear'],
        earphones: ['earphones', 'earphone', 'in-ear', 'neckband', 'earbuds', 'earbud', 'tws'],
        audio: ['audio', 'sound', 'speaker', 'soundbar'],
        speakers: ['speakers', 'speaker', 'soundbar'],
        laptops: ['laptops', 'laptop', 'notebook', 'notebooks', 'ultrabook', 'macbook'],
        electronics: ['electronics'],
        cameras: ['cameras', 'camera', 'mirrorless', 'dslr', 'photography'],
        smartphones: ['smartphone', 'smartphones', 'phone', 'phones', 'mobile', 'galaxy'],
        chargers: ['chargers', 'charger', 'gan', 'fast charger', 'power adapter'],
        mice: ['mouse', 'mice', 'wireless mouse', 'optical mouse'],
        cases: ['phone case', 'protective case', 'case', 'cover', 'mobile cover', 'silicone case', 'earbuds case'],
        sleeves: ['laptop sleeve', 'sleeve', 'laptop bag', 'carrying case'],
        hubs: ['usb-c hub', 'usb hub', 'hub', 'dock', 'docking station'],
        smartwatches: ['smartwatches', 'smartwatch', 'wearables', 'watch', 'fitness'],
        lighting: ['lamp', 'desk light', 'task lamp', 'light'],
        accessories: ['accessories', 'chargers', 'cables', 'hub', 'mouse', 'sleeve', 'case'],
      };

      const synonyms = CATEGORY_SYNONYMS[cat] || CATEGORY_SYNONYMS[singularCat] || [cat, singularCat, pluralCat];

      where.OR = [
        ...synonyms.map((syn) => ({ category: { equals: syn, mode: 'insensitive' as const } })),
        ...synonyms.map((syn) => ({ category: { contains: syn, mode: 'insensitive' as const } })),
        ...synonyms.map((syn) => ({ name: { contains: syn, mode: 'insensitive' as const } })),
        ...synonyms.map((syn) => ({ tags: { has: syn } })),
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
      },
    });

    // 5. Filter out accessories if the user asked for a primary device and NOT an accessory
    const filteredProducts = rawProducts.filter((product) => {
      const isAcc = isAccessoryProduct(product);
      if (isPrimaryCategory && !userWantsAccessory && isAcc) {
        // Disallow accessories from being treated as primary devices (e.g. phone case / silicone case as earbuds or laptop)
        return false;
      }
      return true;
    });

    // 6. Score candidates deterministically
    const scoredCandidates: CandidateProduct[] = filteredProducts.map((product) => {
      const score = this.calculateRelevanceScore(product, intent, isGeneric);
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

    // 7. Prune weak candidates using RELEVANCE_MIN_THRESHOLD
    // Price alone is not sufficient relevance; items must satisfy real query criteria
    let validCandidates = scoredCandidates.filter((candidate) => candidate.relevanceScore >= RELEVANCE_MIN_THRESHOLD);

    // 8. Apply brand exclusions if present in customer intent (Phase 3)
    if (intent.exclusions && intent.exclusions.length > 0) {
      for (const ex of intent.exclusions) {
        const cleanEx = ex.trim().toLowerCase();
        if (cleanEx) {
          validCandidates = validCandidates.filter((c) => {
            const brandMatch = (c.brand || '').toLowerCase().includes(cleanEx);
            const nameMatch = c.name.toLowerCase().includes(cleanEx);
            return !brandMatch && !nameMatch;
          });
        }
      }
    }

    let isBudgetRelaxed = false;

    // 8b. Controlled Nearest-Price Fallback for Primary Device Categories
    // Only triggered if:
    // 1. Requested category is a primary device category (laptops, phones, cameras, earbuds, etc.)
    // 2. Customer did NOT request an accessory
    // 3. A maxPrice constraint exists
    // 4. Strict in-budget retrieval yielded ZERO valid candidates
    if (
      validCandidates.length === 0 &&
      isPrimaryCategory &&
      !userWantsAccessory &&
      typeof intent.maxPrice === 'number' &&
      intent.maxPrice > 0
    ) {
      // Use maximum 20% budget relaxation buffer
      const relaxedMaxPrice = Math.round(intent.maxPrice * 1.20);

      const relaxedWhere: Prisma.ProductWhereInput = {
        ...where,
        price: {
          ...(intent.minPrice !== null && intent.minPrice !== undefined ? { gte: intent.minPrice } : {}),
          gt: intent.maxPrice,
          lte: relaxedMaxPrice,
        },
      };

      const relaxedRawProducts = await prisma.product.findMany({
        where: relaxedWhere,
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
        },
      });

      // Strict accessory filtering: NEVER return accessories as substitutes for a requested primary device
      const relaxedFilteredProducts = relaxedRawProducts.filter((product) => {
        const isAcc = isAccessoryProduct(product);
        if (isPrimaryCategory && !userWantsAccessory && isAcc) {
          return false;
        }
        return true;
      });

      if (relaxedFilteredProducts.length > 0) {
        const relaxedScored: CandidateProduct[] = relaxedFilteredProducts.map((product) => {
          const score = this.calculateRelevanceScore(product, intent, isGeneric);
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
            isBudgetRelaxed: true,
            originalBudgetMax: intent.maxPrice,
          };
        });

        let relaxedValid = relaxedScored.filter((candidate) => candidate.relevanceScore >= RELEVANCE_MIN_THRESHOLD);

        // Apply brand exclusions if present
        if (intent.exclusions && intent.exclusions.length > 0) {
          for (const ex of intent.exclusions) {
            const cleanEx = ex.trim().toLowerCase();
            if (cleanEx) {
              relaxedValid = relaxedValid.filter((c) => {
                const brandMatch = (c.brand || '').toLowerCase().includes(cleanEx);
                const nameMatch = c.name.toLowerCase().includes(cleanEx);
                return !brandMatch && !nameMatch;
              });
            }
          }
        }

        if (relaxedValid.length > 0) {
          // Rule 7: Prefer the cheapest/closest primary-category products above the budget
          relaxedValid.sort((a, b) => {
            if (a.price !== b.price) {
              return a.price - b.price; // closest price above budget first
            }
            return b.relevanceScore - a.relevanceScore;
          });

          validCandidates = relaxedValid;
          isBudgetRelaxed = true;
        }
      }
    }

    // 9. Prioritize non-rejected products over previously rejected products (Phase 3)
    // Avoids previously rejected products when sufficient alternatives exist,
    // without making the catalog artificially empty if alternatives are scarce.
    if (intent.rejectedProductIds && intent.rejectedProductIds.length > 0) {
      const rejectedSet = new Set(intent.rejectedProductIds);
      const nonRejected = validCandidates.filter((c) => !rejectedSet.has(c.id));
      if (nonRejected.length >= 3) {
        // Sufficient alternatives exist: completely avoid rejected products
        validCandidates = nonRejected;
      } else if (nonRejected.length > 0) {
        // Some alternatives exist: prioritize non-rejected first, followed by remaining valid candidates
        const remainingRejected = validCandidates.filter((c) => rejectedSet.has(c.id));
        validCandidates = [...nonRejected, ...remainingRejected];
      }
    }

    // 10. Sort candidates: if budget-relaxed, prioritize lowest price (nearest to budget); otherwise relevance DESC then price ASC
    if (!isBudgetRelaxed) {
      validCandidates.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        if (a.price !== b.price) {
          return a.price - b.price;
        }
        return a.id.localeCompare(b.id);
      });
    }

    // 11. Enforce maximum result limit
    const limitedCandidates = validCandidates.slice(0, MAX_CANDIDATES_LIMIT);

    return {
      products: limitedCandidates,
      count: limitedCandidates.length,
      isBudgetRelaxed,
      originalBudgetMax: isBudgetRelaxed ? intent.maxPrice : undefined,
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
    intent: CustomerIntent,
    isGeneric: boolean = false
  ): number {
    // If generic browse, assign solid baseline score to surface popular/affordable items
    if (isGeneric) {
      return 65;
    }

    let score = 0; // Baseline starts at 0 for specific queries to ensure relevance

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

    // 1. Category Matching (High Weight: +30 pts)
    if (intent.category) {
      const intentCat = intent.category.toLowerCase().trim();
      const singularCat = intentCat.endsWith('s') ? intentCat.slice(0, -1) : intentCat;
      if (prodCat === intentCat || prodCat.includes(singularCat)) {
        score += 30;
      } else if (new RegExp(`\\b${singularCat}\\b`, 'i').test(prodName) || prodName.includes(singularCat)) {
        score += 25;
      } else if (prodTags.some((t) => t.includes(singularCat))) {
        score += 20;
      }
    }

    // 2. Brand Matching (Weight: +25 pts)
    if (intent.brand) {
      const intentBrand = intent.brand.toLowerCase().trim();
      if (prodBrand === intentBrand) {
        score += 25;
      } else if (prodName.includes(intentBrand)) {
        score += 18;
      }
    }

    // 3. Multi-word Preferences Matching (High Weight)
    for (const pref of intent.preferences || []) {
      const cleanPref = pref.toLowerCase().trim();
      if (!cleanPref) continue;

      let prefMatched = false;

      // Match in product name (+30 pts)
      if (prodName.includes(cleanPref)) {
        score += 30;
        prefMatched = true;
      }

      // Match in features (+22 pts)
      if (prodFeatures.some((f) => f.includes(cleanPref))) {
        score += 22;
        prefMatched = true;
      }

      // Match in tags (+18 pts)
      if (prodTags.some((t) => t.includes(cleanPref))) {
        score += 18;
        prefMatched = true;
      }

      // Match in description (+12 pts)
      if (prodDesc.includes(cleanPref)) {
        score += 12;
        prefMatched = true;
      }

      // Match in specifications (+10 pts)
      if (prodSpecsText.includes(cleanPref)) {
        score += 10;
        prefMatched = true;
      }

      // If full multi-word phrase didn't match directly, match individual substantive words from preference
      if (!prefMatched) {
        const prefWords = cleanPref
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !GENERIC_STOP_WORDS.has(w));

        for (const word of prefWords) {
          if (new RegExp(`\\b${word}\\b`, 'i').test(prodName)) score += 14;
          else if (prodFeatures.some((f) => new RegExp(`\\b${word}\\b`, 'i').test(f))) score += 10;
          else if (prodTags.some((t) => new RegExp(`\\b${word}\\b`, 'i').test(t))) score += 8;
          else if (new RegExp(`\\b${word}\\b`, 'i').test(prodDesc)) score += 5;
          else if (prodSpecsText.includes(word)) score += 4;
        }
      }
    }

    // 4. Keyword Matching (Weighted by field prominence, ignoring generic stop words)
    for (const kw of intent.keywords || []) {
      const cleanKw = kw.toLowerCase().trim();
      if (!cleanKw || cleanKw.length < 2 || GENERIC_STOP_WORDS.has(cleanKw)) {
        continue;
      }

      // Exact token in Name (+22 pts)
      if (new RegExp(`\\b${cleanKw}\\b`, 'i').test(prodName)) {
        score += 22;
      } else if (prodName.includes(cleanKw)) {
        score += 16;
      }

      // In Category (+18 pts)
      if (prodCat.includes(cleanKw)) {
        score += 18;
      }

      // In Tags (+14 pts)
      if (prodTags.some((t) => new RegExp(`\\b${cleanKw}\\b`, 'i').test(t) || t.includes(cleanKw))) {
        score += 14;
      }

      // In Features (+12 pts)
      if (prodFeatures.some((f) => new RegExp(`\\b${cleanKw}\\b`, 'i').test(f) || f.includes(cleanKw))) {
        score += 12;
      }

      // In Brand (+10 pts)
      if (prodBrand.includes(cleanKw)) {
        score += 10;
      }

      // In Description (+8 pts)
      if (new RegExp(`\\b${cleanKw}\\b`, 'i').test(prodDesc) || prodDesc.includes(cleanKw)) {
        score += 8;
      }

      // In Specifications (+5 pts)
      if (prodSpecsText.includes(cleanKw)) {
        score += 5;
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
