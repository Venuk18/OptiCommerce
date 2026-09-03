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

export const getStoredMerchantToken = (): string | null => {
  try {
    return localStorage.getItem(MERCHANT_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

// Get the base API URL from environment variable or default to relative path
const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
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

  // Attach merchant Bearer token if present for merchant/auth endpoints (and not already set)
  if (!headers['Authorization'] && !headers['authorization']) {
    const token = getStoredMerchantToken();
    if (token) {
      const isMerchantOrAuthRoute =
        normalizedEndpoint.startsWith('/api/auth/me') ||
        normalizedEndpoint.startsWith('/api/merchant') ||
        normalizedEndpoint.startsWith('/api/stores') ||
        normalizedEndpoint.startsWith('/api/products') ||
        normalizedEndpoint.startsWith('/api/ai/generate-description');
      
      if (isMerchantOrAuthRoute) {
        headers['Authorization'] = `Bearer ${token}`;
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
