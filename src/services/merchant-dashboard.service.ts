import { apiFetch } from './api.client';
import {
  MerchantDashboardSummaryData,
  MerchantFunnelSummaryData,
  MerchantAttributionSummaryData,
  MerchantIntelligenceSummary,
} from '../types';

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

  /**
   * Fetches authoritative merchant attribution metrics for a store.
   *
   * STRICT GUARANTEES:
   * - Consumes GET /api/merchant-dashboard/attribution?storeId=<storeId>
   * - ZERO Gemini / AI calls.
   * - Does not calculate or manipulate attribution metrics on the frontend.
   * - Backend is the sole source of truth.
   */
  async getAttribution(storeId: string): Promise<MerchantAttributionSummaryData> {
    if (!storeId || !storeId.trim()) {
      throw new Error('storeId is required to fetch merchant attribution metrics');
    }

    const cleanStoreId = encodeURIComponent(storeId.trim());
    return apiFetch<MerchantAttributionSummaryData>(
      `/api/merchant-dashboard/attribution?storeId=${cleanStoreId}`
    );
  },

  /**
   * Fetches authoritative merchant revenue intelligence insights for a store.
   *
   * STRICT GUARANTEES:
   * - Consumes GET /api/merchant-dashboard/insights?storeId=<storeId>
   * - ZERO Gemini / AI calls.
   * - Does not calculate or manipulate intelligence metrics on the frontend.
   * - Backend is the sole source of truth.
   */
  async getInsights(storeId: string): Promise<MerchantIntelligenceSummary> {
    if (!storeId || !storeId.trim()) {
      throw new Error('storeId is required to fetch merchant revenue insights');
    }

    const cleanStoreId = encodeURIComponent(storeId.trim());
    return apiFetch<MerchantIntelligenceSummary>(
      `/api/merchant-dashboard/insights?storeId=${cleanStoreId}`
    );
  },
};

