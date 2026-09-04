import { apiFetch } from './api.client';
import { Merchant, CreateMerchantInput } from '../types';

export class MerchantService {
  /**
   * Fetch merchant details along with associated store by merchant ID
   */
  async getMerchant(id: string): Promise<Merchant> {
    return apiFetch<Merchant>(`/api/merchants/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new merchant
   */
  async createMerchant(data: CreateMerchantInput): Promise<Merchant> {
    return apiFetch<Merchant>('/api/merchants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const merchantService = new MerchantService();
