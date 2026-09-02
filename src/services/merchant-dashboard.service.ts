import { apiFetch } from './api.client';
import { MerchantDashboardSummaryData, MerchantFunnelSummaryData } from '../types';

export const merchantDashboardService = {
  /**
   * Fetches authoritative merchant dashboard revenue and conversion metrics for a store.
   *
   * STRICT GUARANTEES:
   * - Consumes GET /api/merchant-dashboard/summary?storeId=<storeId>
   * - ZERO Gemini / AI calls.
   * - Does not calculate or manipulate financial data on the frontend.
   * - Backend is the sole source of truth.
   */
  async getSummary(storeId: string): Promise<MerchantDashboardSummaryData> {
    if (!storeId || !storeId.trim()) {
      throw new Error('storeId is required to fetch merchant dashboard metrics');
    }

    const cleanStoreId = encodeURIComponent(storeId.trim());
    return apiFetch<MerchantDashboardSummaryData>(
      `/api/merchant-dashboard/summary?storeId=${cleanStoreId}`
    );
  },

  /**
   * Fetches authoritative merchant funnel analytics for a store.
   *
   * STRICT GUARANTEES:
   * - Consumes GET /api/merchant-dashboard/funnel?storeId=<storeId>
   * - ZERO Gemini / AI calls.
   * - Does not calculate or manipulate funnel metrics on the frontend.
   * - Backend is the sole source of truth.
   */
  async getFunnel(storeId: string): Promise<MerchantFunnelSummaryData> {
    if (!storeId || !storeId.trim()) {
      throw new Error('storeId is required to fetch merchant funnel analytics');
    }

    const cleanStoreId = encodeURIComponent(storeId.trim());
    return apiFetch<MerchantFunnelSummaryData>(
      `/api/merchant-dashboard/funnel?storeId=${cleanStoreId}`
    );
  },
};

