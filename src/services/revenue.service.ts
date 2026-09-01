import { apiFetch } from './api.client';
import {
  PurchaseProbabilityRequest,
  PurchaseProbabilityData,
  OptimizeRevenueRequest,
  RevenueOptimizationData,
  RecoverSaleRequest,
  RecoverSaleResult,
} from '../types';
import { getAnonymousSessionId } from './event.service';

export const revenueService = {
  /**
   * Fetches deterministic purchase probability estimation for a product within current anonymous session.
   * STRICT ZERO GEMINI CALLS.
   */
  async getPurchaseProbability(
    storeId: string,
    productId: string,
    explicitSessionId?: string
  ): Promise<PurchaseProbabilityData> {
    const sessionId = explicitSessionId || getAnonymousSessionId();

    const payload: PurchaseProbabilityRequest = {
      sessionId,
      storeId,
      productId,
    };

    return apiFetch<PurchaseProbabilityData>('/api/revenue/purchase-probability', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Evaluates candidate discount actions and returns the profit-maximizing recommendation.
   * STRICT ZERO GEMINI CALLS.
   */
  async optimizeRevenue(
    storeId: string,
    productId: string,
    explicitSessionId?: string
  ): Promise<RevenueOptimizationData> {
    const sessionId = explicitSessionId || getAnonymousSessionId();

    const payload: OptimizeRevenueRequest = {
      sessionId,
      storeId,
      productId,
    };

    return apiFetch<RevenueOptimizationData>('/api/revenue/optimize', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Phase 5D: Request optimized customer offer from Phase 5C engine.
   * STRICT ZERO GEMINI CALLS.
   * Backend remains the sole authoritative source of truth.
   * Never sends client-computed price or probability.
   */
  async getOptimizedOffer(
    sessionIdOrStoreId: string,
    storeIdOrProductId: string,
    optionalProductId?: string
  ): Promise<RevenueOptimizationData> {
    let sessionId: string;
    let storeId: string;
    let productId: string;

    if (optionalProductId) {
      // Called as getOptimizedOffer(sessionId, storeId, productId)
      sessionId = sessionIdOrStoreId;
      storeId = storeIdOrProductId;
      productId = optionalProductId;
    } else {
      // Called as getOptimizedOffer(storeId, productId)
      sessionId = getAnonymousSessionId();
      storeId = sessionIdOrStoreId;
      productId = storeIdOrProductId;
    }

    const payload: OptimizeRevenueRequest = {
      sessionId,
      storeId,
      productId,
    };

    return apiFetch<RevenueOptimizationData>('/api/revenue/optimize', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Phase 5E: Request same-store, in-stock alternatives on offer rejection.
   * STRICT ZERO GEMINI CALLS.
   */
  async recoverSale(params: {
    storeId: string;
    rejectedProductId: string;
    sessionId?: string;
    userQuery?: string;
    maxBudget?: number;
    limit?: number;
  }): Promise<RecoverSaleResult> {
    const sessionId = params.sessionId || getAnonymousSessionId();

    const payload: RecoverSaleRequest = {
      sessionId,
      storeId: params.storeId,
      rejectedProductId: params.rejectedProductId,
      userQuery: params.userQuery,
      maxBudget: params.maxBudget,
      limit: params.limit || 3,
    };

    return apiFetch<RecoverSaleResult>('/api/revenue/recover-sale', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

