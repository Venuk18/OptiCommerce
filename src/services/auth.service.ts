import { apiFetch, MERCHANT_TOKEN_STORAGE_KEY } from './api.client';
import { AuthResult, SafeMerchant } from '../types';

export class AuthService {
  /**
   * Retrieves the current stored merchant JWT token from localStorage.
   */
  getToken(): string | null {
    try {
      return localStorage.getItem(MERCHANT_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Stores the merchant JWT token into localStorage under a dedicated key.
   */
  setToken(token: string): void {
    try {
      localStorage.setItem(MERCHANT_TOKEN_STORAGE_KEY, token);
    } catch (err) {
      console.warn('Failed to store merchant token in localStorage', err);
    }
  }

  /**
   * Removes the merchant JWT token from localStorage.
   * Does NOT touch customer session identifiers.
   */
  removeToken(): void {
    try {
      localStorage.removeItem(MERCHANT_TOKEN_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to remove merchant token from localStorage', err);
    }
  }

  /**
   * Registers a new merchant account with an initial store.
   */
  async register(name: string, email: string, password: string, storeName?: string): Promise<AuthResult> {
    const res = await apiFetch<AuthResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, storeName }),
    });
    if (res && res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  /**
   * Logs in an existing merchant with email and password.
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const res = await apiFetch<AuthResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res && res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  /**
   * Fetches the current merchant profile and store from the server using the JWT.
   */
  async getMe(tokenOverride?: string): Promise<SafeMerchant> {
    const token = tokenOverride || this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return apiFetch<SafeMerchant>('/api/auth/me', {
      method: 'GET',
      headers,
    });
  }

  /**
   * Logs out the merchant by wiping the stored token.
   */
  logout(): void {
    this.removeToken();
  }
}

export const authService = new AuthService();
