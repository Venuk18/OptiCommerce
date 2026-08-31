import { AppError } from '../../errors/app.error';
import { RecommendProductsResult } from '../../types/recommendation.types';
import { intentExtractorService } from './intent-extractor.service';
import { candidateRetrievalService } from './candidate-retrieval.service';
import { productRankingService } from './product-ranking.service';

export class RecommendationService {
  /**
   * Orchestrates the 3-step AI commerce recommendation pipeline:
   * 1. Intent Extraction (Phase 4A) - Max 1 Gemini call with deterministic fallback
   * 2. Candidate Retrieval (Phase 4B) - 0 Gemini calls (Deterministic DB query with hard filters)
   * 3. AI Candidate Ranking (Phase 4C) - Max 1 Gemini call with anti-hallucination validation and deterministic fallback
   */
  async getRecommendations(storeId: string, query: string): Promise<RecommendProductsResult> {
    // 1. Input validations
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required and must be a non-empty string', 400);
    }
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new AppError('query is required and must be a non-empty string', 400);
    }

    const cleanStoreId = storeId.trim();
    const cleanQuery = query.trim();

    // 2. Step 1: Extract Customer Intent (Phase 4A)
    const intentResult = await intentExtractorService.extractIntent(cleanQuery);
    const intent = intentResult.intent;

    // 3. Step 2: Retrieve real candidate products from database (Phase 4B)
    const candidatesResult = await candidateRetrievalService.retrieveCandidates(cleanStoreId, intent);
    const candidateProducts = candidatesResult.products;

    // 4. Edge case: No candidates match hard constraints (Category, price range, store scoping, stock > 0, status = PUBLISHED)
    if (!candidateProducts || candidateProducts.length === 0) {
      return {
        query: cleanQuery,
        intent,
        recommendations: [],
        products: [],
        message: 'No matching products found.',
      };
    }

    // 5. Step 3: AI Product Ranking (Phase 4C)
    const rankingResult = await productRankingService.rankCandidates(intent, candidateProducts);

    return {
      query: cleanQuery,
      intent,
      recommendations: rankingResult.rankedProducts,
      products: candidateProducts,
    };
  }
}

export const recommendationService = new RecommendationService();
