import { apiFetch } from './api.client';
import { getAnonymousSessionId } from './event.service';
import { ServerOrderData } from '../types';

export const orderService = {
  /**
   * POST /api/orders/checkout
   * Checkout customer cart to create persistent server-authoritative Order
   */
  async checkout(storeId: string): Promise<ServerOrderData> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<ServerOrderData>('/api/orders/checkout', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        storeId,
      }),
    });
    return response;
  },

  /**
   * GET /api/orders/:id
   * Get single order by ID
   */
  async getOrder(orderId: string, storeId: string): Promise<ServerOrderData> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<ServerOrderData>(
      `/api/orders/${encodeURIComponent(orderId)}?sessionId=${encodeURIComponent(sessionId)}&storeId=${encodeURIComponent(storeId)}`
    );
    return response;
  },

  /**
   * GET /api/orders
   * List customer orders for active session and store
   */
  async listOrders(storeId: string): Promise<ServerOrderData[]> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<ServerOrderData[]>(
      `/api/orders?sessionId=${encodeURIComponent(sessionId)}&storeId=${encodeURIComponent(storeId)}`
    );
    return response;
  },

  /**
   * PATCH /api/orders/:id/confirm
   * Confirm order
   */
  async confirmOrder(orderId: string, storeId: string): Promise<ServerOrderData> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<ServerOrderData>(
      `/api/orders/${encodeURIComponent(orderId)}/confirm`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          sessionId,
          storeId,
        }),
      }
    );
    return response;
  },
};
