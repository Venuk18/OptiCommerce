import { Type } from '@google/genai';
import { CustomerIntent } from '../../types/intent.types';
import { CandidateProduct } from '../../types/search.types';
import { RankedProduct } from '../../types/ranking.types';
import { ConversationState } from '../../types/recommendation.types';
import { getGeminiClient } from './gemini.client';
import { aiProviderOrchestrator } from './providers/ai-provider.orchestrator';
import { aiConfig } from '../../config/ai.config';

export interface ProductReasoning {
  productId: string;
  whyRecommended: string;
  keyAdvantage: string;
  tradeoff?: string | null;
  fitRole: string; // e.g. 'Strongest Overall Fit' | 'Best Value' | 'Premium Pick' | 'Balanced Alternative'
}

export interface SalesReasoningResult {
  salesOverview: string;
  productReasonings: Map<string, ProductReasoning>;
}

const GEMINI_REASONER_TIMEOUT_MS = 6000;

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
];

export class SalesReasonerService {
  /**
   * Main entry point to generate sales reasoning and honest trade-offs for recommended products.
   * Leverages Gemini 3.8 Flash with structured JSON output, guarded by strict anti-hallucination validation.
   * If Gemini is unavailable, times out, or fails validation, seamlessly falls back to deterministic sales reasoning.
   */
  async explainRecommendations(
    intent: CustomerIntent,
    conversationState: ConversationState | null,
    rankedProducts: RankedProduct[],
    candidates: CandidateProduct[],
    aiClientOverride?: any
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

    // 1. Attempt generation with AI provider orchestrator (or aiClientOverride if provided)
    if (aiClientOverride !== undefined) {
      if (aiClientOverride) {
        try {
          const aiResult = await this.reasonWithGemini(
            aiClientOverride,
            intent,
            conversationState,
            rankedProducts,
            shortlistedCandidates
          );

          if (aiResult && this.validateAiSalesReasoning(aiResult, shortlistedCandidates, rankedProducts, intent)) {
            const reasoningMap = new Map<string, ProductReasoning>();
            for (const item of aiResult.productReasonings) {
              reasoningMap.set(item.productId, {
                productId: item.productId,
                whyRecommended: item.whyRecommended.trim(),
                keyAdvantage: item.keyAdvantage.trim(),
                tradeoff: item.tradeoff ? item.tradeoff.trim() : null,
                fitRole: item.fitRole.trim(),
              });
            }

            return {
              salesOverview: aiResult.salesOverview.trim(),
              productReasonings: reasoningMap,
            };
          }
        } catch (error) {
          console.warn('Sales Reasoner override call failed or timed out. Falling back to deterministic sales reasoning.', error);
        }
      }
    } else {
      try {
        const aiResult = await this.reasonWithAI(
          intent,
          conversationState,
          rankedProducts,
          shortlistedCandidates
        );

        if (aiResult && this.validateAiSalesReasoning(aiResult, shortlistedCandidates, rankedProducts, intent)) {
          const reasoningMap = new Map<string, ProductReasoning>();
          for (const item of aiResult.productReasonings) {
            reasoningMap.set(item.productId, {
              productId: item.productId,
              whyRecommended: item.whyRecommended.trim(),
              keyAdvantage: item.keyAdvantage.trim(),
              tradeoff: item.tradeoff ? item.tradeoff.trim() : null,
              fitRole: item.fitRole.trim(),
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
    }

    // 2. Fallback: High-quality, honest deterministic sales reasoning
    return this.deterministicSalesReasoning(intent, conversationState, rankedProducts, shortlistedCandidates);
  }

  /**
   * Calls AI using the multi-provider orchestrator (Groq -> Cerebras -> Gemini)
   * to generate structured sales explanations.
   */
  private async reasonWithAI(
    intent: CustomerIntent,
    conversationState: ConversationState | null,
    rankedProducts: RankedProduct[],
    candidates: CandidateProduct[]
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

    const prompt = `You are OptiCommerce's expert AI commerce sales assistant.
Your job is to explain WHY these shortlisted products are recommended for the customer's goal and highlight honest trade-offs.

CUSTOMER CONTEXT:
- Category / Query: ${intent.category || 'general search'}
- Goal / Use Case: ${conversationState?.goal || intent.useCase || 'not specified'}
- Budget: ${intent.maxPrice ? 'Max ₹' + intent.maxPrice.toLocaleString('en-IN') : 'Flexible'}
- Preferences: ${intent.preferences?.join(', ') || 'None specified'}
- Exclusions: ${intent.exclusions?.join(', ') || conversationState?.exclusions?.join(', ') || 'None'}

SHORTLISTED PRODUCTS (${sanitizedProducts.length} items):
${JSON.stringify(sanitizedProducts, null, 2)}

REQUIREMENTS:
1. Explain WHY each product is recommended for the customer's goal.
2. Identify a genuinely strong "keyAdvantage" grounded strictly in the product's actual specs/features/price.
3. Identify an honest "tradeoff" (e.g. price difference compared to other picks, heavier weight, lacks a specific feature found in others, or near budget ceiling).
4. Assign a concise "fitRole" (e.g. "Strongest Overall Fit", "Best Value", "Premium Pick", "Balanced Alternative").
5. Provide a cohesive, friendly "salesOverview" (2-4 sentences) summarizing the shortlist for the customer, comparing the options directly.
6. STRICT HONESTY: Do NOT invent specifications, benchmarks, or marketing fluff. Avoid words like "absolutely perfect", "unbeatable", or "miraculous". Use grounded phrases like "strongest fit", "better match", "best balance".
7. Return strictly structured JSON matching this schema:
{
  "salesOverview": "A cohesive 2-4 sentence summary comparing the options",
  "productReasonings": [
    {
      "productId": "string",
      "whyRecommended": "string",
      "keyAdvantage": "string",
      "tradeoff": "string or null",
      "fitRole": "string"
    }
  ]
}`;

    const result = await aiProviderOrchestrator.generateJson<{ salesOverview: string; productReasonings: any[] }>(prompt, {
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
              },
              required: ['productId', 'whyRecommended', 'keyAdvantage', 'fitRole'],
            },
          },
        },
        required: ['salesOverview', 'productReasonings'],
      },
      timeoutMs: GEMINI_REASONER_TIMEOUT_MS,
    });

    if (!result?.data || !result.data.salesOverview || !Array.isArray(result.data.productReasonings)) {
      return null;
    }

    return result.data;
  }

  /**
   * Calls Gemini 3.8 Flash structured output to generate sales explanations.
   * Encapsulates all top products in a SINGLE prompt call (never 1 call per product).
   */
  private async reasonWithGemini(
    ai: any,
    intent: CustomerIntent,
    conversationState: ConversationState | null,
    rankedProducts: RankedProduct[],
    candidates: CandidateProduct[]
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

    const prompt = `You are OptiCommerce's expert AI commerce sales assistant.
Your job is to explain WHY these shortlisted products are recommended for the customer's goal and highlight honest trade-offs.

CUSTOMER CONTEXT:
- Category / Query: ${intent.category || 'general search'}
- Goal / Use Case: ${conversationState?.goal || intent.useCase || 'not specified'}
- Budget: ${intent.maxPrice ? 'Max ₹' + intent.maxPrice.toLocaleString('en-IN') : 'Flexible'}
- Preferences: ${intent.preferences?.join(', ') || 'None specified'}
- Exclusions: ${intent.exclusions?.join(', ') || conversationState?.exclusions?.join(', ') || 'None'}

SHORTLISTED PRODUCTS (${sanitizedProducts.length} items):
${JSON.stringify(sanitizedProducts, null, 2)}

REQUIREMENTS:
1. Explain WHY each product is recommended for the customer's goal.
2. Identify a genuinely strong "keyAdvantage" grounded strictly in the product's actual specs/features/price.
3. Identify an honest "tradeoff" (e.g. price difference compared to other picks, heavier weight, lacks a specific feature found in others, or near budget ceiling).
4. Assign a concise "fitRole" (e.g. "Strongest Overall Fit", "Best Value", "Premium Pick", "Balanced Alternative").
5. Provide a cohesive, friendly "salesOverview" (2-4 sentences) summarizing the shortlist for the customer, comparing the options directly.
6. STRICT HONESTY: Do NOT invent specifications, benchmarks, or marketing fluff. Avoid words like "absolutely perfect", "unbeatable", or "miraculous". Use grounded phrases like "strongest fit", "better match", "best balance".`;

    const reasoningPromise = ai.models.generateContent({
      model: aiConfig.gemini.model || 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an authoritative commerce sales advisor. Generate structured sales reasoning grounded strictly in the provided product data. Never invent product features or numbers.',
        responseMimeType: 'application/json',
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
                },
                required: ['productId', 'whyRecommended', 'keyAdvantage', 'fitRole'],
              },
            },
          },
          required: ['salesOverview', 'productReasonings'],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini sales reasoning timed out')), GEMINI_REASONER_TIMEOUT_MS)
    );

    const response = await Promise.race([reasoningPromise, timeoutPromise]);
    const responseText = response.text;

    if (!responseText) {
      return null;
    }

    const parsed = JSON.parse(responseText);
    if (!parsed || !parsed.salesOverview || !Array.isArray(parsed.productReasonings)) {
      return null;
    }

    return parsed;
  }

  /**
   * Strict anti-hallucination validation for AI-generated reasoning.
   * Ensures:
   * 1. All product IDs match candidates. No hallucinated IDs or duplicates.
   * 2. No prohibited marketing superlatives.
   * 3. Numerical specs mentioned in keyAdvantage/tradeoff are verifiable in product data.
   */
  public validateAiSalesReasoning(
    aiResult: any,
    candidates: CandidateProduct[],
    rankedProducts: RankedProduct[],
    intent?: CustomerIntent
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

    const candidateMap = new Map<string, CandidateProduct>();
    for (const c of candidates) {
      candidateMap.set(c.id, c);
    }

    const seenIds = new Set<string>();

    for (const item of aiResult.productReasonings) {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const { productId, whyRecommended, keyAdvantage, fitRole, tradeoff } = item;

      // Product ID must exist in candidate map
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
      if (typeof whyRecommended !== 'string' || !whyRecommended.trim()) {
        return false;
      }
      if (typeof keyAdvantage !== 'string' || !keyAdvantage.trim()) {
        return false;
      }
      if (typeof fitRole !== 'string' || !fitRole.trim()) {
        return false;
      }

      // Check for banned hyperbolic terms
      const combinedText = `${whyRecommended} ${keyAdvantage} ${tradeoff || ''} ${aiResult.salesOverview}`.toLowerCase();
      for (const banned of BANNED_MARKETING_TERMS) {
        if (combinedText.includes(banned)) {
          console.warn(`Honesty check failure: Detected banned marketing hype "${banned}" in AI reasoning.`);
          return false;
        }
      }

      // Authoritative ground check: Look for numerical specs asserted in keyAdvantage
      // If AI claims a specific number with units (e.g. 16GB, 120Hz, 40h), verify it exists in candidate data
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

      const unitPattern = /\b\d+(?:\.\d+)?\s*(?:gb|tb|hz|mah|hours?|hrs?|kg|w|core|inch|")\b/gi;
      const claimedUnits = (keyAdvantage + ' ' + (tradeoff || '')).match(unitPattern);
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
    const goalName = conversationState?.goal || intent.useCase || intent.category || 'your search';

    const reasoningMap = new Map<string, ProductReasoning>();
    const overviewLines: string[] = [];

    // Evaluate each product relative to customer intent and fellow shortlist candidates
    items.forEach((item, index) => {
      const { ranked, product } = item;
      const isTopRank = index === 0;
      const isCheapest = product.price === minPrice && minPrice < maxPriceVal;
      const isMostExpensive = product.price === maxPriceVal && maxPriceVal > minPrice;

      // 1. Determine Role
      let fitRole = 'Balanced Alternative';
      if (isTopRank) {
        fitRole = 'Strongest Overall Fit';
      } else if (isCheapest) {
        fitRole = 'Best Budget Choice';
      } else if (isMostExpensive) {
        fitRole = 'Premium Pick';
      }

      // 2. Determine Key Advantage from authoritative attributes
      let keyAdvantage = '';

      // Check customer preference match first
      if (intent.preferences && intent.preferences.length > 0) {
        const matchingFeature = product.features?.find((f) =>
          intent.preferences!.some((pref) => f.toLowerCase().includes(pref.toLowerCase()))
        );
        if (matchingFeature) {
          keyAdvantage = matchingFeature;
        }
      }

      // If no preference match, pick standout feature from specifications or features
      if (!keyAdvantage && product.features && product.features.length > 0) {
        // Pick a feature with high informational value (battery, ANC, RAM, SSD, sound, display)
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
      if (!isTopRank && isMostExpensive) {
        const diff = product.price - items[0].product.price;
        if (diff > 0) {
          tradeoff = `Costs ₹${diff.toLocaleString('en-IN')} more than the top-ranked option.`;
        } else {
          tradeoff = 'Priced higher than alternative options in this shortlist.';
        }
      } else if (intent.maxPrice && product.price > intent.maxPrice * 0.9) {
        tradeoff = `Priced near your ₹${intent.maxPrice.toLocaleString('en-IN')} budget limit.`;
      } else if (isCheapest && items.length > 1) {
        // Check if top pick has a feature this one lacks (e.g. ANC, higher battery, etc.)
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
      let whyRecommended = `Strong candidate for ${intent.category || product.category}`;
      if (intent.maxPrice) {
        const savings = intent.maxPrice - product.price;
        if (savings >= 500) {
          whyRecommended += ` at ₹${product.price.toLocaleString('en-IN')}, staying ₹${savings.toLocaleString('en-IN')} under your budget`;
        } else {
          whyRecommended += ` within your ₹${intent.maxPrice.toLocaleString('en-IN')} budget`;
        }
      } else {
        whyRecommended += ` at ₹${product.price.toLocaleString('en-IN')}`;
      }

      if (keyAdvantage) {
        whyRecommended += `, highlighting ${keyAdvantage.toLowerCase().startsWith('priced') ? keyAdvantage : keyAdvantage}.`;
      } else {
        whyRecommended += '.';
      }

      reasoningMap.set(product.id, {
        productId: product.id,
        whyRecommended,
        keyAdvantage,
        tradeoff,
        fitRole,
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

    // 5. Construct Cohesive Sales Overview
    let introSentence = '';
    const wasDissatisfied = conversationState?.rejectedProducts && conversationState.rejectedProducts.length > 0;

    if (wasDissatisfied) {
      if (intent.maxPrice) {
        introSentence = `I've refined your shortlist to options strictly under ₹${intent.maxPrice.toLocaleString('en-IN')}:`;
      } else if (intent.brand) {
        introSentence = `I've updated your recommendations to focus on ${intent.brand} options:`;
      } else {
        introSentence = `Here are refined options directly addressing your preferences:`;
      }
    } else {
      introSentence = `I'd shortlist these ${items.length} options for ${goalName}:`;
    }

    const salesOverview = `${introSentence}\n${overviewLines.join('\n')}`;

    return {
      salesOverview,
      productReasonings: reasoningMap,
    };
  }
}

export const salesReasonerService = new SalesReasonerService();
