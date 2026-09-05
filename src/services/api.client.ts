import { ApiResponse } from '../types';

export class ApiError extends Error {
  statusCode: number;
  data?: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export const MERCHANT_TOKEN_STORAGE_KEY = 'opticommerce_merchant_token';
export const CUSTOMER_TOKEN_STORAGE_KEY = 'opticommerce_customer_token';

export const getStoredMerchantToken = (): string | null => {
  try {
    return localStorage.getItem(MERCHANT_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const getStoredCustomerToken = (): string | null => {
  try {
    return localStorage.getItem(CUSTOMER_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setStoredCustomerToken = (token: string): void => {
  try {
    localStorage.setItem(CUSTOMER_TOKEN_STORAGE_KEY, token);
  } catch (err) {
    console.warn('Failed to store customer token in localStorage', err);
  }
};

export const removeStoredCustomerToken = (): void => {
  try {
    localStorage.removeItem(CUSTOMER_TOKEN_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to remove customer token from localStorage', err);
  }
};

// Get the base API URL from environment variable or default to relative path
const getBaseUrl = (): string => {
  const envUrl =
    (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL);
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    // Remove trailing slash if present
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
};

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${normalizedEndpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Attach customer Bearer token or merchant Bearer token based on route isolation (if not already set)
  if (!headers['Authorization'] && !headers['authorization']) {
    const isCustomerRoute =
      normalizedEndpoint.startsWith('/api/customer-auth/me') ||
      normalizedEndpoint.startsWith('/api/cart') ||
      normalizedEndpoint.startsWith('/api/orders');

    if (isCustomerRoute) {
      const customerToken = getStoredCustomerToken();
      if (customerToken) {
        headers['Authorization'] = `Bearer ${customerToken}`;
      }
    } else {
      const isMerchantOrAuthRoute =
        normalizedEndpoint.startsWith('/api/auth/me') ||
        normalizedEndpoint.startsWith('/api/merchant') ||
        normalizedEndpoint.startsWith('/api/stores') ||
        normalizedEndpoint.startsWith('/api/products') ||
        normalizedEndpoint.startsWith('/api/ai/generate-description');

      if (isMerchantOrAuthRoute) {
        const merchantToken = getStoredMerchantToken();
        if (merchantToken) {
          headers['Authorization'] = `Bearer ${merchantToken}`;
        }
      }
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    let jsonResponse: ApiResponse<T>;
    try {
      jsonResponse = await response.json();
    } catch {
      throw new ApiError(
        `Failed to parse server response (Status: ${response.status})`,
        response.status
      );
    }

    if (!response.ok || !jsonResponse.success) {
      const errorMessage =
        jsonResponse.error?.message ||
        `Request failed with status ${response.status}`;
      throw new ApiError(errorMessage, response.status, jsonResponse);
    }

    return jsonResponse.data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network or other unforeseen fetch errors
    throw new ApiError(
      error?.message || 'Network error: Unable to connect to backend server',
      0
    );
  }
}
