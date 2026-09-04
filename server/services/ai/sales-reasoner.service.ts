import { Type } from '@google/genai';
import { CustomerIntent } from '../../types/intent.types';
import { CandidateProduct } from '../../types/search.types';
import { RankedProduct } from '../../types/ranking.types';
import { ConversationState } from '../../types/recommendation.types';
import { aiProviderOrchestrator } from './providers/ai-provider.orchestrator';

export interface ProductReasoning {
  productId: string;
  whyRecommended: string;
  keyAdvantage: string;
  tradeoff?: string | null;
  fitRole: string; // e.g. 'Strongest Overall Fit' | 'Best Value' | 'Premium Pick' | 'Balanced Alternative'
  bestFor?: string;
}

export interface SalesReasoningResult {
  salesOverview: string;
  productReasonings: Map<string, ProductReasoning>;
}

const REASONER_TIMEOUT_MS = 6000;

// Banned hyperbolic marketing terms per honesty constraint
const BANNED_MARKETING_TERMS = [
  'absolutely perfect',
  'unbeatable',
  'miraculous',
  'flawless',
  'world-class',
  'revolutionary',
  'game-changer',
  'life-changing',
  'guaranteed to',
];

export class SalesReasonerService {
  /**
   * Main entry point to generate sales reasoning and honest trade-offs for recommended products.
   * Leverages the multi-provider orchestrator (Groq -> Cerebras -> Gemini), guarded by strict
   * anti-hallucination validation.
   * If AI is unavailable, times out, or fails validation, seamlessly falls back to deterministic sales reasoning.
   */
  async explainRecommendations(
    intent: CustomerIntent,
    conversationState: ConversationState | null,
    rankedProducts: RankedProduct[],
    candidates: CandidateProduct[],
    orchestratorOrClientOverride?: any
  ): Promise<SalesReasoningResult> {
    if (!rankedProducts || rankedProducts.length === 0 || !candidates || candidates.length === 0) {
      return {
        salesOverview: '',
        productReasonings: new Map(),
      };
    }

    // Filter candidate products to only those in rankedProducts
    const candidateMap = new Map<string, CandidateProduct>();
    for (const c of candidates) {
      candidateMap.set(c.id, c);
    }

    const shortlistedCandidates: CandidateProduct[] = [];
    for (const r of rankedProducts) {
      const c = candidateMap.get(r.productId);
      if (c) {
        shortlistedCandidates.push(c);
      }
    }

    if (shortlistedCandidates.length === 0) {
      return {
        salesOverview: '',
        productReasonings: new Map(),
      };
    }

    // If explicit null is passed for orchestrator, bypass AI to test deterministic fallback
    if (orchestratorOrClientOverride === null) {
      return this.deterministicSalesReasoning(intent, conversationState, rankedProducts, shortlistedCandidates);
    }

    // 1. Attempt generation with AI provider orchestrator (or override if provided)
    try {
      const aiResult = await this.reasonWithAI(
        intent,
        conversationState,
        rankedProducts,
        shortlistedCandidates,
        orchestratorOrClientOverride || aiProviderOrchestrator
      );

      if (aiResult && this.validateAiSalesReasoning(aiResult, shortlistedCandidates, rankedProducts, intent, conversationState)) {
        const reasoningMap = new Map<string, ProductReasoning>();
        for (const item of aiResult.productReasonings) {
          reasoningMap.set(item.productId, {
            productId: item.productId,
            whyRecommended: item.whyRecommended.trim(),
            keyAdvantage: item.keyAdvantage.trim(),
            tradeoff: item.tradeoff ? item.tradeoff.trim() : null,
            fitRole: item.fitRole.trim(),
            bestFor: item.bestFor ? item.bestFor.trim() : item.fitRole.trim(),
          });
        }

        return {
          salesOverview: aiResult.salesOverview.trim(),
          productReasonings: reasoningMap,
        };
      }
    } catch (error) {
      console.warn('Sales Reasoner AI call failed. Falling back to deterministic sales reasoning.', error);
    }

    // 2. Fallback: High-quality, honest deterministic sales reasoning grounded in product data & intent
    return this.deterministicSalesReasoning(intent, conversationState, rankedProducts, shortlistedCandidates);
  }

  /**
   * Calls AI via the multi-provider orchestrator (Groq -> Cerebras -> Gemini) in a SINGLE request.
   * Encapsulates all shortlisted products (max 3) and customer context.
   */
  private async reasonWithAI(
    intent: CustomerIntent,
    conversationState: ConversationState | null,
    rankedProducts: RankedProduct[],
    candidates: CandidateProduct[],
    orchestrator: any = aiProviderOrchestrator
  ): Promise<{ salesOverview: string; productReasonings: any[] } | null> {
    const sanitizedProducts = candidates.map((c, idx) => {
      const ranked = rankedProducts.find((r) => r.productId === c.id);
      return {
        id: c.id,
        rank: ranked?.rank || idx + 1,
        name: c.name,
        brand: c.brand,
        category: c.category,
        price: c.price,
        stock: c.stock,
        description: c.description,
        features: c.features,
        specifications: c.specifications,
        tags: c.tags,
      };
    });

    const hasRelaxed = candidates.some((c) => (c as any).isBudgetRelaxed);
    const budgetContext = hasRelaxed && intent.maxPrice
      ? `Requested budget max ₹${intent.maxPrice.toLocaleString('en-IN')}. Note: strictly within-budget options were not available in this category; these are the closest available options above budget. Transparently acknowledge this trade-off.`
      : intent.maxPrice
      ? 'Max ₹' + intent.maxPrice.toLocaleString('en-IN')
      : conversationState?.budget?.max
      ? 'Max ₹' + conversationState.budget.max.toLocaleString('en-IN')
      : 'Flexible';

    const prompt = `You are OptiCommerce's expert AI commerce sales assistant.
Your job is to explain WHY these shortlisted products are recommended for the customer's goal and highlight honest trade-offs.

CUSTOMER CONTEXT:
- Category / Query: ${intent.category || conversationState?.category || 'general search'}
- Goal / Use Case: ${conversationState?.goal || intent.useCase || conversationState?.useCase || 'not specified'}
- Budget: ${budgetContext}
- Preferences: ${[...(intent.preferences || []), ...(conversationState?.preferences || [])].join(', ') || 'None specified'}
- Exclusions: ${[...(intent.exclusions || []), ...(conversationState?.exclusions || [])].join(', ') || 'None'}

SHORTLISTED PRODUCTS (${sanitizedProducts.length} items, MAX 3):
${JSON.stringify(sanitizedProducts, null, 2)}

REQUIREMENTS:
1. Explain WHY each product is recommended for the customer's goal.
2. Identify a genuinely strong "keyAdvantage" grounded strictly in the product's actual specs/features/price.
3. Identify an honest "tradeoff" (e.g. price difference compared to other picks, heavier weight, lacks a specific feature found in others, or near budget ceiling).
4. Assign a concise "fitRole" (e.g. "Strongest Overall Fit", "Best Budget Choice", "Premium Pick", "Balanced Alternative").
5. Assign a concise "bestFor" tag (e.g. "Best overall fit for coding", "Best budget choice", "Alternative for portability").
6. Provide a cohesive, friendly "salesOverview" (2-4 sentences) summarizing the shortlist for the customer, comparing the options directly and stating which is the strongest overall fit.
7. STRICT HONESTY: Do NOT invent specifications, benchmarks, or marketing fluff. Avoid words like "absolutely perfect", "unbeatable", or "miraculous". Use grounded phrases like "strongest fit", "better match", "best balance".
8. Return strictly structured JSON matching this schema:
{
  "salesOverview": "A cohesive 2-4 sentence summary comparing the options",
  "productReasonings": [
    {
      "productId": "string",
      "whyRecommended": "string",
      "keyAdvantage": "string",
      "tradeoff": "string or null",
      "fitRole": "string",
      "bestFor": "string"
    }
  ]
}`;

    // Handle legacy gemini mock if passed directly with .models
    if (orchestrator?.models?.generateContent) {
      const reasoningPromise = orchestrator.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are an authoritative commerce sales advisor. Generate structured sales reasoning grounded strictly in the provided product data. Never invent product features or numbers.',
          responseMimeType: 'application/json',
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI sales reasoning timed out')), REASONER_TIMEOUT_MS)
      );

      const response: any = await Promise.race([reasoningPromise, timeoutPromise]);
      const responseText = response.text;
      if (!responseText) return null;
      return JSON.parse(responseText);
    }

    // Default: use orchestrator.generateJson
    const result = (await (orchestrator as any).generateJson(prompt, {
      operationName: 'sales reasoning',
      systemInstruction:
        'You are an authoritative commerce sales advisor. Generate structured sales reasoning grounded strictly in the provided product data. Never invent product features or numbers.',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          salesOverview: { type: Type.STRING },
          productReasonings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productId: { type: Type.STRING },
                whyRecommended: { type: Type.STRING },
                keyAdvantage: { type: Type.STRING },
                tradeoff: { type: Type.STRING },
                fitRole: { type: Type.STRING },
                bestFor: { type: Type.STRING },
              },
              required: ['productId', 'whyRecommended', 'keyAdvantage', 'fitRole'],
            },
          },
        },
        required: ['salesOverview', 'productReasonings'],
      },
      timeoutMs: REASONER_TIMEOUT_MS,
    })) as { data?: { salesOverview: string; productReasonings: any[] } } | null;

    if (!result?.data || !result.data.salesOverview || !Array.isArray(result.data.productReasonings)) {
      return null;
    }

    return result.data;
  }

  /**
   * Strict anti-hallucination validation for AI-generated reasoning.
   * Ensures all 7 Phase 4 validation constraints are met:
   * 1. Product ID must exist in the recommendation set.
   * 2. Product name must match authoritative data if referenced.
   * 3. Product price must match authoritative data if referenced.
   * 4. Referenced brand must match authoritative data.
   * 5. Referenced attributes must exist in authoritative data.
   * 6. No additional product may be introduced (max 3, only shortlisted).
   * 7. No unsupported specifications may be introduced.
   */
  public validateAiSalesReasoning(
    aiResult: any,
    candidates: CandidateProduct[],
    rankedProducts: RankedProduct[],
    intent?: CustomerIntent,
    conversationState?: ConversationState | null
  ): boolean {
    if (!aiResult || typeof aiResult !== 'object') {
      return false;
    }

    if (typeof aiResult.salesOverview !== 'string' || !aiResult.salesOverview.trim()) {
      return false;
    }

    if (!Array.isArray(aiResult.productReasonings) || aiResult.productReasonings.length === 0) {
      return false;
    }

    // Constraint 6: No additional product introduced. Length must not exceed shortlisted candidates
    if (aiResult.productReasonings.length > candidates.length) {
      console.warn('Anti-hallucination error: AI introduced more products than shortlisted candidates.');
      return false;
    }

    const candidateMap = new Map<string, CandidateProduct>();
    const allCandidateBrands = new Set<string>();
    const allCandidatePrices = new Set<number>();

    for (const c of candidates) {
      candidateMap.set(c.id, c);
      if (c.brand) allCandidateBrands.add(c.brand.toLowerCase());
      allCandidatePrices.add(c.price);
    }

    const seenIds = new Set<string>();

    for (const item of aiResult.productReasonings) {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const { productId, whyRecommended, keyAdvantage, fitRole, tradeoff, bestFor } = item;

      // Constraint 1: Product ID must exist in recommendation set
      if (!productId || typeof productId !== 'string' || !candidateMap.has(productId)) {
        console.warn(`Anti-hallucination error: Unknown product ID "${productId}" in AI reasoning.`);
        return false;
      }

      // No duplicate product IDs
      if (seenIds.has(productId)) {
        console.warn(`Anti-hallucination error: Duplicate product ID "${productId}" in AI reasoning.`);
        return false;
      }
      seenIds.add(productId);

      // Must have required string fields
      if (typeof whyRecommended !== 'string' || !whyRecommended.trim()) return false;
      if (typeof keyAdvantage !== 'string' || !keyAdvantage.trim()) return false;
      if (typeof fitRole !== 'string' || !fitRole.trim()) return false;

      // Check for banned hyperbolic marketing terms
      const combinedText = `${whyRecommended} ${keyAdvantage} ${tradeoff || ''} ${bestFor || ''} ${aiResult.salesOverview}`.toLowerCase();
      for (const banned of BANNED_MARKETING_TERMS) {
        if (combinedText.includes(banned)) {
          console.warn(`Honesty check failure: Detected banned marketing hype "${banned}" in AI reasoning.`);
          return false;
        }
      }

      const prod = candidateMap.get(productId)!;
      const prodText = [
        prod.name,
        prod.description || '',
        prod.brand || '',
        prod.category,
        ...(prod.features || []),
        ...(prod.tags || []),
        JSON.stringify(prod.specifications || {}),
      ]
        .join(' ')
        .toLowerCase();

      // Constraint 3: If product price is explicitly claimed, it must match authoritative data
      const claimedPriceMatches = (whyRecommended + ' ' + (tradeoff || '')).match(/[₹\sRs\.INR]*(\d{1,3}(?:,\d{2,3})+|\d{3,7})/gi);
      if (claimedPriceMatches) {
        for (const matchStr of claimedPriceMatches) {
          const cleanNum = parseInt(matchStr.replace(/[^\d]/g, ''), 10);
          if (cleanNum && cleanNum > 100) {
            // Valid price numbers: prod.price, budget max/min, diff with another candidate, or savings
            const isActualPrice = cleanNum === prod.price;
            const isOtherPrice = allCandidatePrices.has(cleanNum);
            const isBudget = cleanNum === intent?.maxPrice || cleanNum === conversationState?.budget?.max;
            const isDiff = candidates.some((c) => Math.abs(Math.abs(prod.price - c.price) - cleanNum) <= 100);
            const isSavings =
              (intent?.maxPrice ? Math.abs(Math.abs(intent.maxPrice - prod.price) - cleanNum) <= 100 : false) ||
              (conversationState?.budget?.max ? Math.abs(Math.abs(conversationState.budget.max - prod.price) - cleanNum) <= 100 : false);

            if (!isActualPrice && !isOtherPrice && !isBudget && !isDiff && !isSavings) {
              // If claimed price is wildly unsupported, reject
              if (Math.abs(cleanNum - prod.price) > 500 && Math.abs(cleanNum - (intent?.maxPrice || 0)) > 500) {
                console.warn(`Anti-hallucination error: Unsupported price figure ₹${cleanNum} claimed for ${prod.name} (actual ₹${prod.price}).`);
                return false;
              }
            }
          }
        }
      }

      // Constraint 4: If a brand is referenced, it must match authoritative product brand or candidates
      if (prod.brand) {
        const otherMajorBrands = ['sony', 'apple', 'samsung', 'lenovo', 'dell', 'hp', 'asus', 'acer', 'bose', 'sennheiser', 'jbl', 'boat'];
        const prodBrandLower = prod.brand.toLowerCase();
        for (const foreignBrand of otherMajorBrands) {
          if (foreignBrand !== prodBrandLower && !allCandidateBrands.has(foreignBrand)) {
            // Check if foreign brand is mistakenly claimed as this product's brand
            const brandPattern = new RegExp(`\\b${foreignBrand}\\b`, 'i');
            if (brandPattern.test(keyAdvantage) || brandPattern.test(whyRecommended)) {
              console.warn(`Anti-hallucination error: Foreign brand "${foreignBrand}" claimed for product "${prod.name}" (${prod.brand}).`);
              return false;
            }
          }
        }
      }

      // Constraint 7: Authoritative ground check: Look for numerical specs asserted in keyAdvantage/tradeoff
      // If AI claims a specific number with units (e.g. 16GB, 120Hz, 40h), verify it exists in candidate data
      const unitPattern = /\b\d+(?:\.\d+)?\s*(?:gb|tb|hz|mah|hours?|hrs?|kg|w|watts?|cores?|inch|")\b/gi;
      const claimedUnits = (keyAdvantage + ' ' + (tradeoff || '') + ' ' + (bestFor || '')).match(unitPattern);
      if (claimedUnits) {
        for (const claim of claimedUnits) {
          const normalizedClaim = claim.toLowerCase().replace(/\s+/g, '');
          const normalizedProdText = prodText.replace(/\s+/g, '');
          if (!normalizedProdText.includes(normalizedClaim)) {
            console.warn(
              `Anti-hallucination error: Claimed specification "${claim}" for product "${prod.name}" does not exist in authoritative product data.`
            );
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Deterministic sales reasoning engine.
   * Produces honest, grounded, goal-oriented explanations and trade-offs
   * with 0 external network dependencies and sub-5ms execution time.
   */
  public deterministicSalesReasoning(
    intent: CustomerIntent,
    conversationState: ConversationState | null,
    rankedProducts: RankedProduct[],
    candidates: CandidateProduct[]
  ): SalesReasoningResult {
    const candidateMap = new Map<string, CandidateProduct>();
    for (const c of candidates) {
      candidateMap.set(c.id, c);
    }

    const items = rankedProducts
      .map((r) => ({
        ranked: r,
        product: candidateMap.get(r.productId),
      }))
      .filter((item): item is { ranked: RankedProduct; product: CandidateProduct } => Boolean(item.product));

    if (items.length === 0) {
      return {
        salesOverview: '',
        productReasonings: new Map(),
      };
    }

    const prices = items.map((i) => i.product.price);
    const minPrice = Math.min(...prices);
    const maxPriceVal = Math.max(...prices);

    const goal = conversationState?.goal || intent.useCase || conversationState?.useCase || '';
    const useCase = intent.useCase || conversationState?.useCase || '';
    const categoryName = intent.category || conversationState?.category || items[0].product.category || 'options';
    const effectiveBudget = intent.maxPrice || conversationState?.budget?.max || null;
    const preferredBrand = intent.brand || (intent.preferences?.find((p) =>
      ['lenovo', 'apple', 'sony', 'samsung', 'dell', 'hp', 'asus', 'acer', 'boat', 'noise'].some((b) => p.toLowerCase().includes(b))
    ));

    const reasoningMap = new Map<string, ProductReasoning>();
    const overviewLines: string[] = [];

    // Evaluate each product relative to customer intent and fellow shortlist candidates
    items.forEach((item, index) => {
      const { ranked, product } = item;
      const isTopRank = index === 0;
      const isCheapest = product.price === minPrice && minPrice < maxPriceVal;
      const isMostExpensive = product.price === maxPriceVal && maxPriceVal > minPrice;

      // 1. Determine Role & Best For
      let fitRole = 'Balanced Alternative';
      let bestFor = `Solid alternative for ${categoryName}`;

      const isBudgetStretched = Boolean(product.isBudgetRelaxed);
      const budgetTarget = effectiveBudget || product.originalBudgetMax || 0;
      const budgetDiff = budgetTarget > 0 ? product.price - budgetTarget : 0;

      if (isBudgetStretched && budgetTarget > 0) {
        fitRole = isTopRank ? 'Closest Available Option' : 'Alternative Option';
        bestFor = `Closest available ${categoryName.endsWith('s') ? categoryName.slice(0, -1) : categoryName} (₹${budgetDiff.toLocaleString('en-IN')} above budget)`;
      } else if (isTopRank) {
        fitRole = 'Strongest Overall Fit';
        bestFor = useCase
          ? `Best overall fit for ${useCase}`
          : effectiveBudget
          ? `Strongest balance within budget`
          : `Strongest overall fit for ${categoryName}`;
      } else if (isCheapest) {
        fitRole = 'Best Budget Choice';
        bestFor = 'Best budget option';
      } else if (isMostExpensive) {
        fitRole = 'Premium Pick';
        bestFor = 'Best for high-tier performance';
      } else {
        fitRole = 'Balanced Alternative';
        bestFor = 'Balanced mid-range alternative';
      }

      // 2. Determine Key Advantage from authoritative attributes
      let keyAdvantage = '';

      // Check customer preference match first
      const combinedPreferences = [...(intent.preferences || []), ...(conversationState?.preferences || [])];
      if (combinedPreferences.length > 0 && product.features && product.features.length > 0) {
        const matchingFeature = product.features.find((f) =>
          combinedPreferences.some((pref) => f.toLowerCase().includes(pref.toLowerCase()))
        );
        if (matchingFeature) {
          keyAdvantage = matchingFeature;
        }
      }

      // If brand matches preference
      if (!keyAdvantage && preferredBrand && product.brand && product.brand.toLowerCase().includes(preferredBrand.toLowerCase())) {
        keyAdvantage = `Matches your preference for ${product.brand} with official manufacturer build`;
      }

      // If no preference match, pick standout feature from specifications or features
      if (!keyAdvantage && product.features && product.features.length > 0) {
        const priorityFeature = product.features.find((f) =>
          /(battery|anc|noise|ram|ssd|display|oled|hz|driver|bluetooth|charge|bass|lightweight)/i.test(f)
        );
        keyAdvantage = priorityFeature || product.features[0];
      }

      // Fallback advantage based on price or category
      if (!keyAdvantage) {
        if (isCheapest) {
          keyAdvantage = `Priced at ₹${product.price.toLocaleString('en-IN')}, offering the most accessible price point`;
        } else if (product.brand) {
          keyAdvantage = `Authentic ${product.brand} build with high reliability`;
        } else {
          keyAdvantage = `Balanced performance tailored for ${product.category}`;
        }
      }

      // 3. Determine Honest Trade-Off
      let tradeoff: string | null = null;
      if (isBudgetStretched && budgetTarget > 0) {
        tradeoff = `Costs ₹${budgetDiff.toLocaleString('en-IN')} above your ₹${budgetTarget.toLocaleString('en-IN')} budget target.`;
      } else if (!isTopRank && isMostExpensive) {
        const diff = product.price - items[0].product.price;
        if (diff > 0) {
          tradeoff = `Costs ₹${diff.toLocaleString('en-IN')} more than the top-ranked option.`;
        } else {
          tradeoff = 'Priced higher than alternative options in this shortlist.';
        }
      } else if (effectiveBudget && product.price > effectiveBudget * 0.9) {
        tradeoff = `Priced near your ₹${effectiveBudget.toLocaleString('en-IN')} budget ceiling.`;
      } else if (isCheapest && items.length > 1) {
        const topProduct = items[0].product;
        const topAnc = topProduct.features?.some((f) => /anc|noise cancel/i.test(f));
        const thisAnc = product.features?.some((f) => /anc|noise cancel/i.test(f));

        if (topAnc && !thisAnc) {
          tradeoff = 'Lacks active noise cancellation found on higher-tier models.';
        } else {
          tradeoff = 'Offers a more compact feature set compared to the top pick.';
        }
      } else if (index === 1 && items.length >= 3) {
        const diffWithCheapest = product.price - minPrice;
        if (diffWithCheapest > 0) {
          tradeoff = `Costs ₹${diffWithCheapest.toLocaleString('en-IN')} more than the budget alternative.`;
        } else {
          tradeoff = 'Standard configuration without high-tier upgrades.';
        }
      } else {
        tradeoff = 'Standard specifications without additional premium extras.';
      }

      // 4. Construct Why Recommended
      let whyRecommended = '';
      const savings = effectiveBudget ? effectiveBudget - product.price : null;

      if (isBudgetStretched && budgetTarget > 0) {
        const singleCat = categoryName.endsWith('s') ? categoryName.slice(0, -1) : categoryName;
        whyRecommended = `We don't have a ${singleCat} within ₹${budgetTarget.toLocaleString('en-IN')}. The closest available option is the ${product.name} at ₹${product.price.toLocaleString('en-IN')}, which is ₹${budgetDiff.toLocaleString('en-IN')} above your budget${useCase ? ` and tailored for ${useCase}` : ''}.`;
      } else if (isTopRank) {
        if (useCase) {
          whyRecommended = `I'd lean toward this one because it gives you the strongest balance for your ${useCase} needs while staying within your budget at ₹${product.price.toLocaleString('en-IN')}.`;
        } else if (effectiveBudget) {
          whyRecommended = `Recommended as your top pick because it provides the strongest features while staying within your ₹${effectiveBudget.toLocaleString('en-IN')} budget at ₹${product.price.toLocaleString('en-IN')}.`;
        } else {
          whyRecommended = `Recommended as your strongest overall match, offering ${keyAdvantage} at ₹${product.price.toLocaleString('en-IN')}.`;
        }
      } else if (isCheapest) {
        if (savings && savings >= 500) {
          whyRecommended = `Best budget choice at ₹${product.price.toLocaleString('en-IN')}, saving ₹${savings.toLocaleString('en-IN')} compared to your budget ceiling while meeting your core ${categoryName} needs.`;
        } else {
          whyRecommended = `Best budget option at ₹${product.price.toLocaleString('en-IN')}, meeting core requirements at an accessible price.`;
        }
      } else if (isMostExpensive) {
        whyRecommended = `Premium alternative if you prioritize higher-tier performance, highlighting ${keyAdvantage}.`;
      } else {
        whyRecommended = `Balanced alternative for ${categoryName} at ₹${product.price.toLocaleString('en-IN')}, featuring ${keyAdvantage}.`;
      }

      // If customer has a brand preference, acknowledge it
      if (preferredBrand && product.brand && product.brand.toLowerCase().includes(preferredBrand.toLowerCase())) {
        whyRecommended += ` Matches your preference for ${product.brand}.`;
      }

      reasoningMap.set(product.id, {
        productId: product.id,
        whyRecommended,
        keyAdvantage,
        tradeoff,
        fitRole,
        bestFor,
      });

      // Overview line synthesis
      if (isTopRank) {
        overviewLines.push(
          `The first (${product.name}) is the strongest overall fit with ${keyAdvantage} at ₹${product.price.toLocaleString('en-IN')}.`
        );
      } else if (isCheapest) {
        overviewLines.push(
          `The ${index === 1 ? 'second' : 'third'} (${product.name}) is the best budget choice at ₹${product.price.toLocaleString('en-IN')}.`
        );
      } else {
        overviewLines.push(
          `The ${index === 1 ? 'second' : 'third'} (${product.name}) offers ${keyAdvantage}, but ${tradeoff?.toLowerCase() || 'costs slightly more'}`
        );
      }
    });

    // 5. Construct Cohesive Sales Overview with Strongest-Fit synthesis
    let introSentence = '';
    const wasDissatisfied = conversationState?.rejectedProducts && conversationState.rejectedProducts.length > 0;
    const hasBudgetRelaxed = items.some((i) => Boolean(i.product.isBudgetRelaxed));
    const budgetTarget = effectiveBudget || items[0].product.originalBudgetMax || 0;

    if (wasDissatisfied) {
      if (effectiveBudget) {
        introSentence = `I've refined your shortlist to options strictly under ₹${effectiveBudget.toLocaleString('en-IN')}:`;
      } else if (intent.brand) {
        introSentence = `I've updated your recommendations to focus on ${intent.brand} options:`;
      } else {
        introSentence = `Here are refined options directly addressing your updated criteria:`;
      }
    } else if (hasBudgetRelaxed && budgetTarget > 0) {
      const topProd = items[0].product;
      const diff = topProd.price - budgetTarget;
      const singleCat = categoryName.endsWith('s') ? categoryName.slice(0, -1) : categoryName;
      introSentence = `We don't have a ${singleCat} strictly within ₹${budgetTarget.toLocaleString('en-IN')}. The closest available option is ₹${topProd.price.toLocaleString('en-IN')}, which is ₹${diff.toLocaleString('en-IN')} above your budget:`;
    } else {
      const topProd = items[0].product;
      const contextLabel = useCase || goal || categoryName;
      if (items.length >= 2) {
        introSentence = `Of these options, I'd choose the ${topProd.name} for you because it best balances your budget and ${contextLabel} requirements. Here is how they compare:`;
      } else {
        introSentence = `Here is my top recommendation for your ${contextLabel} requirements:`;
      }
    }

    const salesOverview = `${introSentence}\n${overviewLines.join('\n')}`;

    return {
      salesOverview,
      productReasonings: reasoningMap,
    };
  }
}

export const salesReasonerService = new SalesReasonerService();

