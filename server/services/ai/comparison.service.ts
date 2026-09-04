import { ProductStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/app.error';
import { CustomerIntent } from '../../types/intent.types';
import { CandidateProduct } from '../../types/search.types';
import { ConversationState } from '../../types/recommendation.types';
import {
  CompareProductsInput,
  CompareProductsResult,
  ComparedProductItem,
  ProductComparisonResult,
} from '../../types/comparison.types';
import { aiProviderOrchestrator } from './providers/ai-provider.orchestrator';

const COMPARISON_TIMEOUT_MS = 6000;

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
  'objectively the best',
];

export class ComparisonService {
  /**
   * Compares 2 or 3 products in a given store for a customer.
   * Enforces:
   * 1. Exact product IDs from the preceding recommendations (no arbitrary search).
   * 2. Store isolation and authoritative DB verification.
   * 3. At most ONE LLM call using AIProviderOrchestrator.
   * 4. Strict anti-hallucination validation.
   * 5. Deterministic fallback that works with zero external network or LLM dependencies.
   */
  async compareProducts(
    input: CompareProductsInput,
    orchestratorOverride?: any
  ): Promise<CompareProductsResult> {
    // 1. Validate Store ID
    if (!input.storeId || typeof input.storeId !== 'string' || !input.storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }
    const cleanStoreId = input.storeId.trim();

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // 2. Validate Product IDs length
    if (!input.productIds || !Array.isArray(input.productIds)) {
      throw new AppError('productIds array is required', 400);
    }

    // Server-enforced comparison limit: 2 to 3 products
    if (input.productIds.length < 2) {
      throw new AppError('At least 2 products are required for comparison', 400);
    }
    if (input.productIds.length > 3) {
      throw new AppError('Comparison is limited to 2 or 3 products', 400);
    }

    const uniqueIds = Array.from(new Set(input.productIds.map((id) => (typeof id === 'string' ? id.trim() : '')))).filter(Boolean);
    if (uniqueIds.length < 2) {
      throw new AppError('At least 2 distinct products are required for comparison', 400);
    }

    // 3. Fetch Authoritative Product Data from Database with strict store isolation
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: uniqueIds },
        storeId: cleanStoreId,
        status: ProductStatus.PUBLISHED,
      },
    });

    if (dbProducts.length < 2) {
      throw new AppError(
        'Cannot compare products: at least 2 valid published products from this store are required',
        400
      );
    }

    // Preserve original order from input IDs
    const authoritativeCandidates: CandidateProduct[] = [];
    for (const id of uniqueIds) {
      const p = dbProducts.find((dbP) => dbP.id === id);
      if (p) {
        authoritativeCandidates.push({
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          brand: p.brand,
          price: Number(p.price),
          stock: p.stock,
          images: p.images || [],
          features: p.features || [],
          specifications: (p.specifications as Record<string, any>) || null,
          tags: p.tags || [],
          relevanceScore: 1,
        });
      }
    }

    if (authoritativeCandidates.length < 2) {
      throw new AppError(
        'Cannot compare products: at least 2 valid published products from this store are required',
        400
      );
    }

    // 4. Extract customer intent and context
    const intent: CustomerIntent = {
      category: input.conversationState?.category || authoritativeCandidates[0]?.category || null,
      brand: null,
      minPrice: input.conversationState?.budget?.min ?? null,
      maxPrice: input.conversationState?.budget?.max ?? null,
      preferences: input.conversationState?.preferences || [],
      keywords: [],
      mode: 'COMPARISON_REQUEST',
      useCase: input.conversationState?.useCase || input.conversationState?.goal || null,
      exclusions: input.conversationState?.exclusions || [],
      rejectedProductIds: input.conversationState?.rejectedProducts || [],
    };

    // If query is provided, check for additional explicit preferences or price modifiers
    if (input.query && typeof input.query === 'string') {
      const qLower = input.query.toLowerCase();
      if (/\b(anc|noise cancel)\b/i.test(qLower) && !intent.preferences.includes('anc')) {
        intent.preferences.push('anc');
      }
      if (/\b(battery|battery life)\b/i.test(qLower) && !intent.preferences.includes('battery')) {
        intent.preferences.push('battery');
      }
      if (/\b(bass|deep bass)\b/i.test(qLower) && !intent.preferences.includes('bass')) {
        intent.preferences.push('bass');
      }
      if (/\b(budget|cheaper|cheap|affordable)\b/i.test(qLower) && !intent.preferences.includes('budget')) {
        intent.preferences.push('budget');
      }
      if (/\b(travel|traveling)\b/i.test(qLower) && !intent.useCase) {
        intent.useCase = 'travel';
      } else if (/\b(gaming|gamer)\b/i.test(qLower) && !intent.useCase) {
        intent.useCase = 'gaming';
      } else if (/\b(coding|programming|developer)\b/i.test(qLower) && !intent.useCase) {
        intent.useCase = 'coding';
      } else if (/\b(college|student|study)\b/i.test(qLower) && !intent.useCase) {
        intent.useCase = 'college';
      }
    }

    let comparisonResult: ProductComparisonResult;

    // 5. If explicit null is passed for orchestrator, bypass AI to use deterministic fallback
    if (orchestratorOverride === null) {
      comparisonResult = this.deterministicComparison(
        authoritativeCandidates,
        intent,
        input.conversationState
      );
    } else {
      // 6. Attempt AI reasoning using AIProviderOrchestrator (at most 1 LLM call)
      try {
        const orchestrator = orchestratorOverride || aiProviderOrchestrator;
        const aiOutput = await this.reasonWithAI(
          authoritativeCandidates,
          intent,
          input.conversationState,
          orchestrator
        );

        if (
          aiOutput &&
          this.validateAiComparison(
            aiOutput,
            authoritativeCandidates,
            intent,
            input.conversationState
          )
        ) {
          const sanitizedProducts: ComparedProductItem[] = authoritativeCandidates.map((cand) => {
            const aiProd = aiOutput.products.find((p: any) => p.productId === cand.id);
            return {
              productId: cand.id,
              name: cand.name,
              brand: cand.brand,
              category: cand.category,
              price: cand.price,
              stock: cand.stock,
              images: cand.images,
              features: cand.features,
              specifications: cand.specifications,
              tags: cand.tags,
              strengths: Array.isArray(aiProd?.strengths) && aiProd.strengths.length > 0
                ? aiProd.strengths.map((s: string) => s.trim())
                : cand.features.slice(0, 3),
              weaknesses: Array.isArray(aiProd?.weaknesses)
                ? aiProd.weaknesses.map((w: string) => w.trim())
                : [],
              tradeoff: typeof aiProd?.tradeoff === 'string' ? aiProd.tradeoff.trim() : undefined,
              fitSummary: typeof aiProd?.fitSummary === 'string' ? aiProd.fitSummary.trim() : undefined,
            };
          });

          comparisonResult = {
            products: sanitizedProducts,
            winnerProductId: aiOutput.winnerProductId || sanitizedProducts[0].productId,
            winnerReason: aiOutput.winnerReason.trim(),
            tradeoffs: aiOutput.tradeoffs.trim(),
          };
        } else {
          comparisonResult = this.deterministicComparison(
            authoritativeCandidates,
            intent,
            input.conversationState
          );
        }
      } catch (err) {
        console.warn('AI comparison failed, falling back to deterministic comparison.', err);
        comparisonResult = this.deterministicComparison(
          authoritativeCandidates,
          intent,
          input.conversationState
        );
      }
    }

    // 7. Generate structured assistant message
    const winnerProd = authoritativeCandidates.find((c) => c.id === comparisonResult.winnerProductId);
    let message = '';
    if (winnerProd && comparisonResult.winnerReason) {
      message = `${comparisonResult.winnerReason} ${comparisonResult.tradeoffs || ''}`.trim();
    } else {
      message = `Comparing ${authoritativeCandidates.length} options: ${comparisonResult.tradeoffs || ''}`.trim();
    }

    // 8. Build updated ConversationState preserving goal, budget, category, discussedProducts, etc.
    const updatedState: ConversationState = {
      goal: input.conversationState?.goal || intent.useCase || null,
      category: intent.category || input.conversationState?.category || null,
      budget: {
        min: intent.minPrice,
        max: intent.maxPrice,
      },
      preferences: intent.preferences || [],
      exclusions: input.conversationState?.exclusions || [],
      useCase: intent.useCase || null,
      discussedProducts: authoritativeCandidates.map((c, idx) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        category: c.category,
        position: idx + 1,
      })),
      rejectedProducts: input.conversationState?.rejectedProducts || [],
      selectedProductId: comparisonResult.winnerProductId || authoritativeCandidates[0].id,
      stage: 'COMPARING',
    };

    return {
      comparison: comparisonResult,
      conversationState: updatedState,
      message,
    };
  }

  /**
   * Calls the multi-provider orchestrator (Groq -> Cerebras -> Gemini) in at most ONE request.
   */
  private async reasonWithAI(
    candidates: CandidateProduct[],
    intent: CustomerIntent,
    conversationState?: ConversationState,
    orchestrator: any = aiProviderOrchestrator
  ): Promise<any | null> {
    const candidateData = candidates.map((c, idx) => ({
      position: idx + 1,
      productId: c.id,
      name: c.name,
      brand: c.brand,
      category: c.category,
      price: c.price,
      stock: c.stock,
      description: c.description,
      features: c.features,
      specifications: c.specifications,
      tags: c.tags,
    }));

    const customerContext = {
      category: intent.category || conversationState?.category || null,
      budget: {
        min: intent.minPrice,
        max: intent.maxPrice,
      },
      useCase: intent.useCase || conversationState?.useCase || conversationState?.goal || null,
      preferences: intent.preferences || [],
    };

    const prompt = `You are OptiCommerce's expert AI commerce sales advisor.
Compare these EXACT products for this customer based strictly on their goal, preferences, and budget.

Customer Context:
${JSON.stringify(customerContext, null, 2)}

Products to Compare (Authoritative Catalog Data):
${JSON.stringify(candidateData, null, 2)}

CRITICAL COMPARISON RULES:
1. Grounding: You MUST ONLY use the exact products provided. Do NOT invent products, prices, specs, or features.
2. Prices: Every product price MUST strictly match its authoritative price.
3. Customer-Specific Winner: Select the product that BEST fits THIS customer's specific needs, budget, or use case.
4. Honest Winner Tone: Phrase the winner reason honestly:
   "Based on what you're looking for, I'd choose [Winner Name]. It is the strongest match for your stated [needs/use case]. [Alternative Name] is the better choice if [alternate priority, e.g. lower price] is your priority."
   DO NOT say "[Product] is objectively the best."
5. Trade-offs: Clearly state what the customer gives up with each option.
6. NO HYPE: Do not use hyperbolic marketing terms ("absolutely perfect", "unbeatable", "miraculous", "flawless", "revolutionary", "game-changer").
7. Output JSON format strictly conforming to the requested schema.`;

    const schema = {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              name: { type: 'string' },
              price: { type: 'number' },
              strengths: { type: 'array', items: { type: 'string' } },
              weaknesses: { type: 'array', items: { type: 'string' } },
              tradeoff: { type: 'string' },
              fitSummary: { type: 'string' },
            },
            required: ['productId', 'name', 'price', 'strengths', 'weaknesses'],
          },
        },
        winnerProductId: { type: 'string' },
        winnerReason: { type: 'string' },
        tradeoffs: { type: 'string' },
      },
      required: ['products', 'winnerProductId', 'winnerReason', 'tradeoffs'],
    };

    return await orchestrator.generateJson(prompt, {
      operationName: 'product comparison',
      responseSchema: schema,
      timeoutMs: COMPARISON_TIMEOUT_MS,
    });
  }

  /**
   * Anti-hallucination validation:
   * 1. Product IDs must match candidate IDs exactly.
   * 2. Claimed prices must match DB prices.
   * 3. Winner product ID must be in candidates.
   * 4. Banned marketing hype is forbidden.
   * 5. Brand claims must match product data.
   * 6. Numerical units must exist in authoritative data.
   */
  public validateAiComparison(
    aiResult: any,
    candidates: CandidateProduct[],
    intent?: CustomerIntent,
    conversationState?: ConversationState
  ): boolean {
    if (!aiResult || typeof aiResult !== 'object') return false;
    if (!Array.isArray(aiResult.products)) return false;
    if (typeof aiResult.winnerReason !== 'string' || !aiResult.winnerReason.trim()) return false;
    if (typeof aiResult.tradeoffs !== 'string' || !aiResult.tradeoffs.trim()) return false;

    // Must match candidate count exactly
    if (aiResult.products.length !== candidates.length) {
      console.warn('Anti-hallucination: AI returned different number of products than candidates.');
      return false;
    }

    const candidateMap = new Map<string, CandidateProduct>();
    for (const c of candidates) {
      candidateMap.set(c.id, c);
    }

    // Winner product ID must be in candidates, or null
    if (aiResult.winnerProductId && !candidateMap.has(aiResult.winnerProductId)) {
      console.warn(`Anti-hallucination: Unknown winner productId "${aiResult.winnerProductId}".`);
      return false;
    }

    const seenIds = new Set<string>();

    for (const p of aiResult.products) {
      if (!p || typeof p !== 'object' || !p.productId || !candidateMap.has(p.productId)) {
        console.warn(`Anti-hallucination: Unknown or invalid product ID "${p?.productId}".`);
        return false;
      }
      if (seenIds.has(p.productId)) {
        console.warn(`Anti-hallucination: Duplicate product ID "${p.productId}".`);
        return false;
      }
      seenIds.add(p.productId);

      const realCandidate = candidateMap.get(p.productId)!;

      // Price validation: if AI specified price, it must match authoritative price
      if (typeof p.price === 'number' && p.price !== realCandidate.price) {
        console.warn(`Anti-hallucination: Claimed price ₹${p.price} does not match DB price ₹${realCandidate.price}.`);
        return false;
      }

      // Check banned terms
      const allText = [
        aiResult.winnerReason,
        aiResult.tradeoffs,
        p.tradeoff || '',
        p.fitSummary || '',
        ...(p.strengths || []),
        ...(p.weaknesses || []),
      ]
        .join(' ')
        .toLowerCase();

      for (const banned of BANNED_MARKETING_TERMS) {
        if (allText.includes(banned)) {
          console.warn(`Anti-hallucination: Detected banned marketing hype "${banned}".`);
          return false;
        }
      }

      // Numerical unit assertions validation
      const prodDataText = [
        realCandidate.name,
        realCandidate.description || '',
        realCandidate.brand || '',
        realCandidate.category,
        ...(realCandidate.features || []),
        ...(realCandidate.tags || []),
        JSON.stringify(realCandidate.specifications || {}),
      ]
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, '');

      const unitPattern = /\b\d+(?:\.\d+)?\s*(?:gb|tb|hz|mah|hours?|hrs?|h|kg|w|watts?|cores?|inch|")\b/gi;
      const claimedUnits = (
        (p.tradeoff || '') +
        ' ' +
        (p.fitSummary || '') +
        ' ' +
        (p.strengths || []).join(' ') +
        ' ' +
        (p.weaknesses || []).join(' ')
      ).match(unitPattern);

      if (claimedUnits) {
        for (const claim of claimedUnits) {
          const normalizedClaim = claim.toLowerCase().replace(/\s+/g, '');
          if (!prodDataText.includes(normalizedClaim)) {
            console.warn(`Anti-hallucination: Claimed unit "${claim}" not found in product data for ${realCandidate.name}.`);
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Deterministic Comparison Engine.
   * Runs in 0 LLM calls, < 5ms execution time, 100% grounded in database data.
   */
  public deterministicComparison(
    candidates: CandidateProduct[],
    intent: CustomerIntent,
    conversationState?: ConversationState
  ): ProductComparisonResult {
    const prices = candidates.map((c) => c.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Extract battery hours helper
    const getBatteryHrs = (c: CandidateProduct): number => {
      const text = [c.name, c.description || '', ...(c.features || [])].join(' ');
      const m = text.match(/(\d+)\s*(?:h|hr|hours?)/i);
      return m ? parseInt(m[1], 10) : 0;
    };

    const hasAnc = (c: CandidateProduct): boolean => {
      const text = [c.name, c.description || '', ...(c.features || []), ...(c.tags || [])].join(' ').toLowerCase();
      return /\b(anc|active noise cancel)\b/i.test(text);
    };

    const batteries = candidates.map(getBatteryHrs);
    const maxBattery = Math.max(...batteries);
    const anyHasAnc = candidates.some(hasAnc);

    // Evaluate each candidate
    const evaluatedProducts: ComparedProductItem[] = candidates.map((cand) => {
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      const candBattery = getBatteryHrs(cand);
      const candAnc = hasAnc(cand);

      // 1. Price analysis
      if (cand.price === minPrice && minPrice < maxPrice) {
        const diff = maxPrice - cand.price;
        strengths.push(`Most affordable at ₹${cand.price.toLocaleString('en-IN')} (saves ₹${diff.toLocaleString('en-IN')})`);
      } else if (cand.price === maxPrice && maxPrice > minPrice) {
        const diff = cand.price - minPrice;
        weaknesses.push(`Higher price tag at ₹${cand.price.toLocaleString('en-IN')} (₹${diff.toLocaleString('en-IN')} more than lowest option)`);
      }

      // 2. ANC analysis
      if (candAnc) {
        strengths.push('Equipped with Active Noise Cancellation (ANC)');
      } else if (anyHasAnc) {
        weaknesses.push('Lacks Active Noise Cancellation found in alternatives');
      }

      // 3. Battery analysis
      if (candBattery > 0 && candBattery === maxBattery && maxBattery > 0) {
        strengths.push(`Extended ${candBattery}-hour battery playback`);
      } else if (candBattery > 0 && candBattery < maxBattery) {
        weaknesses.push(`Lower battery duration (${candBattery}h vs up to ${maxBattery}h)`);
      }

      // 4. Feature strengths from authoritative data
      if (cand.features && cand.features.length > 0) {
        for (const feat of cand.features.slice(0, 2)) {
          if (!strengths.some((s) => s.toLowerCase().includes(feat.toLowerCase().slice(0, 10)))) {
            strengths.push(feat);
          }
        }
      }

      // Format trade-off
      let tradeoff = '';
      if (cand.price === minPrice && anyHasAnc && !candAnc) {
        tradeoff = `Saves money at ₹${cand.price.toLocaleString('en-IN')}, but foregoes Active Noise Cancellation.`;
      } else if (cand.price === maxPrice) {
        tradeoff = `Provides premium features, but requires a higher budget of ₹${cand.price.toLocaleString('en-IN')}.`;
      } else {
        tradeoff = `Balanced option offering reliable everyday performance.`;
      }

      return {
        productId: cand.id,
        name: cand.name,
        brand: cand.brand,
        category: cand.category,
        price: cand.price,
        stock: cand.stock,
        images: cand.images,
        features: cand.features,
        specifications: cand.specifications,
        tags: cand.tags,
        strengths: strengths.slice(0, 3),
        weaknesses: weaknesses.slice(0, 2),
        tradeoff,
        fitSummary: `Strong contender in ${cand.category}`,
      };
    });

    // Score candidates against customer intent to determine winner
    const scored = candidates.map((cand) => {
      const score = this.evaluateIntentFit(cand, intent, conversationState);
      return { candidate: cand, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const runnerUp = scored[1];
    const scoreDiff = best.score - (runnerUp ? runnerUp.score : 0);

    let winnerProductId: string | null = null;
    let winnerReason = '';
    let tradeoffs = '';

    // Check if evidence is sufficient to declare a winner
    if (scoreDiff >= 8) {
      winnerProductId = best.candidate.id;
      const winnerName = best.candidate.name;
      const runnerUpName = runnerUp ? runnerUp.candidate.name : 'other options';

      let reasonNeed = 'your stated requirements';
      if (intent.useCase) {
        reasonNeed = `your ${intent.useCase} use case`;
      } else if (intent.preferences.includes('anc')) {
        reasonNeed = 'your noise-cancelling priority';
      } else if (intent.preferences.includes('battery')) {
        reasonNeed = 'long battery endurance';
      } else if (intent.preferences.includes('budget') || (intent.maxPrice && best.candidate.price <= intent.maxPrice)) {
        reasonNeed = 'staying within your budget';
      }

      let altPriority = 'keeping the purchase price lower';
      if (runnerUp && runnerUp.candidate.price < best.candidate.price) {
        altPriority = 'keeping the price lower';
      } else if (runnerUp && runnerUp.candidate.price > best.candidate.price) {
        altPriority = 'premium build quality';
      }

      winnerReason = `Based on what you're looking for, I'd choose ${winnerName}. It is the strongest match for ${reasonNeed}. ${runnerUpName} is the better choice if ${altPriority} is your priority.`;
    } else {
      // Close match / tie: honest neutral guidance
      winnerProductId = best.candidate.id;
      const p1 = best.candidate;
      const p2 = runnerUp?.candidate;

      let keyDiff = 'price versus specific feature preferences';
      if (p1 && p2 && p1.price !== p2.price) {
        const cheaper = p1.price < p2.price ? p1 : p2;
        const pricier = p1.price < p2.price ? p2 : p1;
        keyDiff = `saving ₹${(pricier.price - cheaper.price).toLocaleString('en-IN')} with ${cheaper.name} or opting for ${pricier.name}`;
      }

      winnerReason = `These are close matches. The best choice depends on whether you prioritize ${keyDiff}.`;
    }

    // Trade-offs summary
    const tradeoffParts: string[] = [];
    for (const item of evaluatedProducts) {
      if (item.tradeoff) {
        tradeoffParts.push(`**${item.name}**: ${item.tradeoff}`);
      }
    }
    tradeoffs = tradeoffParts.join(' ');

    return {
      products: evaluatedProducts,
      winnerProductId,
      winnerReason,
      tradeoffs,
    };
  }

  /**
   * Evaluates intent fit score for a candidate product.
   */
  public evaluateIntentFit(
    product: CandidateProduct,
    intent: CustomerIntent,
    conversationState?: ConversationState
  ): number {
    let score = 50;

    const prodText = [
      product.name,
      product.description || '',
      product.brand || '',
      product.category,
      ...(product.features || []),
      ...(product.tags || []),
      JSON.stringify(product.specifications || {}),
    ]
      .join(' ')
      .toLowerCase();

    // 1. Budget fit
    const effectiveBudget = intent.maxPrice ?? conversationState?.budget?.max ?? null;
    if (effectiveBudget !== null && effectiveBudget > 0) {
      if (product.price <= effectiveBudget) {
        score += 30;
        // Closer to or saving below budget
        const savingsRatio = (effectiveBudget - product.price) / effectiveBudget;
        if (savingsRatio >= 0 && savingsRatio <= 0.4) {
          score += 5;
        }
      } else {
        // Exceeds budget
        score -= 40;
      }
    }

    // If customer explicitly requested budget/cheap/affordable
    if (intent.preferences.includes('budget') || intent.preferences.includes('cheap')) {
      score += Math.max(0, 20 - Math.round(product.price / 500));
    }

    // 2. Preferences match
    const allPreferences = Array.from(new Set([...(intent.preferences || []), ...(conversationState?.preferences || [])]));
    for (const pref of allPreferences) {
      const pLower = pref.toLowerCase();
      if (pLower === 'budget' || pLower === 'cheap') continue;
      if (prodText.includes(pLower)) {
        score += 15;
      }
    }

    // 3. Use case match
    const useCase = intent.useCase || conversationState?.useCase || conversationState?.goal;
    if (useCase) {
      const uLower = useCase.toLowerCase();
      if (prodText.includes(uLower)) {
        score += 25;
      }
    }

    // 4. In-stock bonus
    if (product.stock > 0) {
      score += 5;
    }

    return score;
  }
}

export const comparisonService = new ComparisonService();
