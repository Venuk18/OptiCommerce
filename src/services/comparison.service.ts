import { apiFetch } from './api.client';
import { CompareRequestInput, CompareResponse } from '../types';

export const comparisonService = {
  /**
   * Calls the Phase 5 in-chat comparison endpoint:
   * POST /api/ai/compare
   */
  async compare(input: CompareRequestInput): Promise<CompareResponse> {
    if (!input.storeId || !input.storeId.trim()) {
      throw new Error('Store ID is required for product comparison');
    }
    if (!input.productIds || !Array.isArray(input.productIds) || input.productIds.length < 2) {
      throw new Error('At least 2 products are required for comparison');
    }

    return apiFetch<CompareResponse>('/api/ai/compare', {
      method: 'POST',
      body: JSON.stringify({
        storeId: input.storeId.trim(),
        productIds: input.productIds,
        conversationState: input.conversationState,
        query: input.query,
      }),
    });
  },
};
