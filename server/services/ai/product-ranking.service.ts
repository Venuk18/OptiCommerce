import { Type } from '@google/genai';
import { CustomerIntent } from '../../types/intent.types';
import { CandidateProduct } from '../../types/search.types';
import { RankedProduct, RankProductsResult } from '../../types/ranking.types';
import { getGeminiClient } from './gemini.client';

const MAX_CANDIDATES = 10;
const GEMINI_TIMEOUT_MS = 6000;

export class ProductRankingService {
  /**
   * Main entry point to rank candidate products for a given customer intent.
   * If Gemini is unavailable, fails validation, or times out, uses deterministic fallback ranking.
   */
  async rankCandidates(intent: CustomerIntent, candidates: CandidateProduct[]): Promise<RankProductsResult> {
    // 1. Edge case: empty candidates list
    if (!candidates || candidates.length === 0) {
      return { rankedProducts: [] };
    }

    // 2. Cap candidates at maximum 10
    const boundedCandidates = candidates.slice(0, MAX_CANDIDATES);

    // 3. Try ranking with Gemini (at most ONE Gemini call)
    const geminiClient = getGeminiClient();
    if (geminiClient) {
      try {
        const aiRankings = await this.rankWithGemini(geminiClient, intent, boundedCandidates);
        if (aiRankings && this.validateAiRankings(aiRankings, boundedCandidates)) {
          return { rankedProducts: aiRankings };
        }
      } catch (error) {
        console.warn('Gemini product ranking failed or timed out. Falling back to deterministic ranking.', error);
      }
    }

    // 4. Fallback: Deterministic ranking using Phase 4B relevance scores
    const fallbackRankings = this.deterministicFallbackRanking(intent, boundedCandidates);
    return { rankedProducts: fallbackRankings };
  }

  /**
   * Ranks candidates using Gemini 3.7 Flash structured outputs.
   */
  private async rankWithGemini(
    ai: any,
    intent: CustomerIntent,
    candidates: CandidateProduct[]
  ): Promise<RankedProduct[] | null> {
    // Sanitize input sent to Gemini - absolutely NO costPrice or merchant data
    const sanitizedCandidates = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      category: c.category,
      brand: c.brand,
      price: c.price,
      features: c.features,
      specifications: c.specifications,
      tags: c.tags,
      relevanceScore: c.relevanceScore,
    }));

    const prompt = `You are an expert commerce ranking assistant.
Rank ONLY the provided candidate products according to the customer's intent.

CUSTOMER INTENT:
${JSON.stringify(intent, null, 2)}

CANDIDATE PRODUCTS (${sanitizedCandidates.length} items):
${JSON.stringify(sanitizedCandidates, null, 2)}

RANKING CRITERIA:
1. Category and price match (strictly prioritize candidates within budget: ${intent.maxPrice ? 'under ₹' + intent.maxPrice : 'any'}).
2. Explicit customer preferences (e.g. ${intent.preferences?.join(', ') || 'none specified'}).
3. Relevant keywords (${intent.keywords?.join(', ') || 'none'}).
4. Product specifications and features.

STRICT INSTRUCTIONS:
- Rank ALL candidate products in order of relevance to the customer (rank 1 = top match).
- Assign a matchScore from 0 to 100 for each product.
- Provide a concise, customer-friendly explanation (1-2 sentences) in the "reason" field explaining why this product satisfies their query.
- NEVER invent new product IDs, names, or specifications. Use ONLY the given product IDs.`;

    const rankingPromise = ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an AI product ranking system. Output strictly structured JSON according to the schema. Rank ONLY the candidate products provided in the prompt. Never invent product IDs or features.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rankedProducts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productId: { type: Type.STRING },
                  rank: { type: Type.INTEGER },
                  matchScore: { type: Type.INTEGER },
                  reason: { type: Type.STRING },
                },
                required: ['productId', 'rank', 'matchScore', 'reason'],
              },
            },
          },
          required: ['rankedProducts'],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini ranking request timed out')), GEMINI_TIMEOUT_MS)
    );

    const response = await Promise.race([rankingPromise, timeoutPromise]);
    const responseText = response.text?.();

    if (!responseText) {
      return null;
    }

    const parsed = JSON.parse(responseText);
    if (!parsed || !Array.isArray(parsed.rankedProducts)) {
      return null;
    }

    return parsed.rankedProducts;
  }

  /**
   * Strict anti-hallucination validation on Gemini's ranking output.
   */
  public validateAiRankings(rankedList: any[], candidates: CandidateProduct[]): boolean {
    if (!Array.isArray(rankedList) || rankedList.length === 0) {
      return false;
    }

    const candidateMap = new Map<string, CandidateProduct>();
    for (const c of candidates) {
      candidateMap.set(c.id, c);
    }

    const seenProductIds = new Set<string>();

    for (let i = 0; i < rankedList.length; i++) {
      const item = rankedList[i];

      // Must be an object
      if (!item || typeof item !== 'object') {
        return false;
      }

      // Check productId existence in candidates
      if (!item.productId || typeof item.productId !== 'string' || !candidateMap.has(item.productId)) {
        console.warn(`Anti-hallucination failure: Product ID "${item.productId}" was not in the candidate list.`);
        return false;
      }

      // No duplicate product IDs
      if (seenProductIds.has(item.productId)) {
        console.warn(`Duplicate product ID detected in AI ranking: ${item.productId}`);
        return false;
      }
      seenProductIds.add(item.productId);

      // Check matchScore bounds (0 - 100)
      if (typeof item.matchScore !== 'number' || isNaN(item.matchScore) || item.matchScore < 0 || item.matchScore > 100) {
        return false;
      }

      // Check rank is a valid positive integer
      if (typeof item.rank !== 'number' || item.rank < 1) {
        return false;
      }

      // Check reason is a non-empty string
      if (!item.reason || typeof item.reason !== 'string' || !item.reason.trim()) {
        return false;
      }
    }

    // Number of ranked products cannot exceed candidate count
    if (rankedList.length > candidates.length) {
      return false;
    }

    return true;
  }

  /**
   * Deterministic fallback ranking algorithm based on Phase 4B relevance scores.
   */
  public deterministicFallbackRanking(
    intent: CustomerIntent,
    candidates: CandidateProduct[]
  ): RankedProduct[] {
    // Clone candidates and sort by relevanceScore descending, then price ascending, then id
    const sorted = [...candidates].sort((a, b) => {
      const scoreA = typeof a.relevanceScore === 'number' && !isNaN(a.relevanceScore) ? a.relevanceScore : 50;
      const scoreB = typeof b.relevanceScore === 'number' && !isNaN(b.relevanceScore) ? b.relevanceScore : 50;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      const priceA = typeof a.price === 'number' && !isNaN(a.price) ? a.price : 0;
      const priceB = typeof b.price === 'number' && !isNaN(b.price) ? b.price : 0;
      if (priceA !== priceB) {
        return priceA - priceB;
      }
      return (a.id || '').localeCompare(b.id || '');
    });

    const maxScore = sorted.length > 0
      ? Math.max(...sorted.map((s) => (typeof s.relevanceScore === 'number' && !isNaN(s.relevanceScore) ? s.relevanceScore : 50)), 1)
      : 1;

    return sorted.map((product, idx) => {
      const relScore = typeof product.relevanceScore === 'number' && !isNaN(product.relevanceScore) ? product.relevanceScore : 50;
      // Scale relevance score to a 60–98 match score range deterministically
      const normalizedRatio = Math.max(0, Math.min(1, relScore / Math.max(maxScore, 100)));
      const matchScore = Math.min(98, Math.max(50, Math.round(60 + normalizedRatio * 38)));

      // Construct clean, informative reason
      let reason = `Matches your search for ${intent.category || 'items'}`;
      const prodPrice = typeof product.price === 'number' && !isNaN(product.price) ? product.price : 0;
      if (intent.maxPrice && prodPrice <= intent.maxPrice) {
        reason += ` at ₹${prodPrice.toLocaleString('en-IN')}, well within your ₹${intent.maxPrice.toLocaleString('en-IN')} budget.`;
      } else if (prodPrice > 0) {
        reason += ` at ₹${prodPrice.toLocaleString('en-IN')}.`;
      }

      if (intent.preferences && intent.preferences.length > 0) {
        const matchingPrefs = intent.preferences.filter((p) =>
          product.features?.some((f) => f.toLowerCase().includes(p.toLowerCase())) ||
          (product.name && product.name.toLowerCase().includes(p.toLowerCase())) ||
          product.tags?.some((t) => t.toLowerCase().includes(p.toLowerCase()))
        );
        if (matchingPrefs.length > 0) {
          reason += ` Highlights: ${matchingPrefs.join(', ')}.`;
        }
      }

      return {
        productId: product.id,
        rank: idx + 1,
        matchScore,
        reason,
      };
    });
  }
}

export const productRankingService = new ProductRankingService();
