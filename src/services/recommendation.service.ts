import { apiFetch } from './api.client';
import { RecommendRequestInput, RecommendationResponse } from '../types';

export const recommendationService = {
  /**
   * Calls the Phase 4D recommendation orchestration endpoint:
   * POST /api/ai/recommend
   */
  async recommend(input: RecommendRequestInput): Promise<RecommendationResponse> {
    if (!input.storeId || !input.storeId.trim()) {
      throw new Error('Store ID is required for AI recommendations');
    }
    if (!input.query || !input.query.trim()) {
      throw new Error('Query is required for AI recommendations');
    }

    return apiFetch<RecommendationResponse>('/api/ai/recommend', {
      method: 'POST',
      body: JSON.stringify({
        storeId: input.storeId.trim(),
        query: input.query.trim(),
        conversationContext: input.conversationContext,
        cartProductIds: input.cartProductIds,
        focusedProductId: input.focusedProductId,
        sessionId: input.sessionId,
      }),
    });
  },
};
