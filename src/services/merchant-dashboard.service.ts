import { apiFetch } from './api.client';
import {
  MerchantDashboardSummaryData,
  MerchantFunnelSummaryData,
  MerchantAttributionSummaryData,
  MerchantIntelligenceSummary,
  MerchantOrderData,
  MerchantOrdersData,
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

  /**
   * Fetches paginated customer orders for a store with filtering and search.
   */
  async getOrders(
    storeId: string,
    filters: {
      status?: 'ALL' | 'READY_TO_PROCESS' | 'PENDING_PAYMENT' | 'CANCELLED';
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<MerchantOrdersData> {
    if (!storeId || !storeId.trim()) {
      throw new Error('storeId is required to fetch orders');
    }

    const query = new URLSearchParams();
    query.set('storeId', storeId.trim());

    if (filters.status && filters.status !== 'ALL') {
      query.set('status', filters.status);
    }
    if (filters.search && filters.search.trim()) {
      query.set('search', filters.search.trim());
    }
    if (filters.page) {
      query.set('page', String(filters.page));
    }
    if (filters.limit) {
      query.set('limit', String(filters.limit));
    }

    return apiFetch<MerchantOrdersData>(
      `/api/merchant-dashboard/orders?${query.toString()}`
    );
  },

  /**
   * Fetches single order details for a store.
   */
  async getOrderDetails(storeId: string, orderId: string): Promise<MerchantOrderData> {
    if (!orderId || !orderId.trim()) {
      throw new Error('orderId is required to fetch order details');
    }

    const cleanOrderId = encodeURIComponent(orderId.trim());
    return apiFetch<MerchantOrderData>(
      `/api/merchant-dashboard/orders/${cleanOrderId}`
    );
  },

  /**
   * Cancels an order, restores reserved product inventory, and maintains payment invariant.
   */
  async cancelOrder(storeId: string, orderId: string): Promise<MerchantOrderData> {
    if (!orderId || !orderId.trim()) {
      throw new Error('orderId is required to cancel an order');
    }

    const cleanOrderId = encodeURIComponent(orderId.trim());
    return apiFetch<MerchantOrderData>(
      `/api/merchant-dashboard/orders/${cleanOrderId}/cancel`,
      {
        method: 'PATCH',
      }
    );
  },
};

