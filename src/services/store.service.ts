import { apiFetch } from './api.client';
import { Store, StoreStatus, CreateStoreInput, UpdateStoreInput } from '../types';

export class StoreService {
  /**
   * Fetch store details along with merchant relation by store slug
   */
  async getStore(slug: string): Promise<Store> {
    return apiFetch<Store>(`/api/stores/${encodeURIComponent(slug)}`);
  }

  /**
   * Create a new store for a merchant
   */
  async createStore(data: CreateStoreInput): Promise<Store> {
    return apiFetch<Store>('/api/stores', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update store name, slug, and description
   */
  async updateStore(id: string, data: UpdateStoreInput): Promise<Store> {
    return apiFetch<Store>(`/api/stores/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update store publishing status (PUBLISHED / UNPUBLISHED)
   */
  async updateStoreStatus(id: string, status: StoreStatus): Promise<Store> {
    return apiFetch<Store>(`/api/stores/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
}

export const storeService = new StoreService();
