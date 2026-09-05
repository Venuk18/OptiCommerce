import { apiFetch, getStoredCustomerToken, setStoredCustomerToken, removeStoredCustomerToken } from './api.client';
import { CustomerAuthResult, SafeCustomer } from '../types';

export class CustomerAuthService {
  /**
   * Retrieves the current stored customer JWT token from localStorage.
   */
  getToken(): string | null {
    return getStoredCustomerToken();
  }

  /**
   * Stores the customer JWT token into localStorage under dedicated key 'opticommerce_customer_token'.
   */
  setToken(token: string): void {
    setStoredCustomerToken(token);
  }

  /**
   * Removes the customer JWT token from localStorage.
   * Does NOT touch opticommerce_merchant_token or opticommerce_session_id.
   */
  removeToken(): void {
    removeStoredCustomerToken();
  }

  /**
   * Registers a new customer in the specified store.
   * POST /api/customer-auth/register
   */
  async register(email: string, password: string, storeId: string, name?: string): Promise<CustomerAuthResult> {
    const payload: { email: string; password: string; storeId: string; name?: string } = {
      email,
      password,
      storeId,
    };
    if (name && name.trim()) {
      payload.name = name.trim();
    }

    const res = await apiFetch<CustomerAuthResult>('/api/customer-auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res && res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  /**
   * Logs in an existing customer in the specified store.
   * POST /api/customer-auth/login
   */
  async login(email: string, password: string, storeId: string): Promise<CustomerAuthResult> {
    const res = await apiFetch<CustomerAuthResult>('/api/customer-auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, storeId }),
    });

    if (res && res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  /**
   * Fetches the current customer profile from the server using the JWT.
   * GET /api/customer-auth/me
   */
  async getMe(tokenOverride?: string): Promise<SafeCustomer> {
    const token = tokenOverride || this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await apiFetch<{ customer: SafeCustomer } | SafeCustomer>('/api/customer-auth/me', {
      method: 'GET',
      headers,
    });
    return (res as any).customer || res;
  }

  /**
   * Logs out the customer by wiping the customer token.
   * Preserves opticommerce_merchant_token and opticommerce_session_id.
   */
  logout(): void {
    this.removeToken();
  }
}

export const customerAuthService = new CustomerAuthService();
