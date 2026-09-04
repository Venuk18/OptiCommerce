import { apiFetch } from './api.client';
import { getAnonymousSessionId } from './event.service';
import { ServerCartData, BundleSuggestionsResponseData, CartCrossSellResult } from '../types';

export const cartService = {
  /**
   * GET /api/cart - Get current session's cart for a given store
   */
  async getCart(storeId: string): Promise<ServerCartData> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<{ cart: ServerCartData }>(
      `/api/cart?sessionId=${encodeURIComponent(sessionId)}&storeId=${encodeURIComponent(storeId)}`
    );
    return response.cart;
  },

  /**
   * POST /api/cart/items - Add a product to the cart
   */
  async addItem(storeId: string, productId: string, quantity: number = 1): Promise<ServerCartData> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<{ cart: ServerCartData }>('/api/cart/items', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        storeId,
        productId,
        quantity,
      }),
    });
    return response.cart;
  },

  /**
   * PATCH /api/cart/items/:itemId - Update item quantity in the cart
   */
  async updateItemQuantity(storeId: string, itemId: string, quantity: number): Promise<ServerCartData> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<{ cart: ServerCartData }>(`/api/cart/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        sessionId,
        storeId,
        quantity,
      }),
    });
    return response.cart;
  },

  /**
   * DELETE /api/cart/items/:itemId - Remove item from cart
   */
  async removeItem(storeId: string, itemId: string): Promise<ServerCartData> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<{ cart: ServerCartData }>(
      `/api/cart/items/${encodeURIComponent(itemId)}?sessionId=${encodeURIComponent(sessionId)}&storeId=${encodeURIComponent(storeId)}`,
      {
        method: 'DELETE',
      }
    );
    return response.cart;
  },

  /**
   * POST /api/cart/bundles - Get deterministic complementary product bundle suggestions
   */
  async getBundleSuggestions(storeId: string, productId: string, limit: number = 3): Promise<BundleSuggestionsResponseData> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<BundleSuggestionsResponseData>('/api/cart/bundles', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        storeId,
        productId,
        limit,
      }),
    });
    return response;
  },

  /**
   * POST /api/cart/cross-sell - Get cart-aware cross-sell and intelligent bundling suggestions (Phase 6)
   */
  async getCartCrossSell(
    storeId: string,
    options?: {
      focusedProductId?: string;
      query?: string;
      conversationState?: any;
      limit?: number;
      suppressDuplicates?: boolean;
    }
  ): Promise<CartCrossSellResult> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<CartCrossSellResult>('/api/cart/cross-sell', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        storeId,
        focusedProductId: options?.focusedProductId,
        query: options?.query,
        conversationState: options?.conversationState,
        limit: options?.limit ?? 3,
        suppressDuplicates: options?.suppressDuplicates ?? false,
      }),
    });
    return response;
  },

  /**
   * DELETE /api/cart - Clear entire cart for session and store
   */
  async clearCart(storeId: string): Promise<ServerCartData> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<{ cart: ServerCartData }>(
      `/api/cart?sessionId=${encodeURIComponent(sessionId)}&storeId=${encodeURIComponent(storeId)}`,
      {
        method: 'DELETE',
      }
    );
    return response.cart;
  },
};
