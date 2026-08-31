import { apiFetch } from './api.client';
import { DbProduct, ProductStatus, GetProductsFilter, CreateProductInput } from '../types';

export class ProductService {
  /**
   * Fetch products with optional filtering by storeId, category, and status
   */
  async getProducts(filters: GetProductsFilter = {}): Promise<DbProduct[]> {
    const params = new URLSearchParams();
    if (filters.storeId && filters.storeId.trim()) {
      params.append('storeId', filters.storeId.trim());
    }
    if (filters.category && filters.category.trim() && filters.category !== 'All') {
      params.append('category', filters.category.trim());
    }
    if (filters.status && filters.status.trim() && filters.status !== 'ALL') {
      params.append('status', filters.status.trim());
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/api/products?${queryString}` : '/api/products';
    return apiFetch<DbProduct[]>(endpoint);
  }

  /**
   * Fetch a single product by ID
   */
  async getProduct(id: string): Promise<DbProduct> {
    return apiFetch<DbProduct>(`/api/products/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new product for a store
   */
  async createProduct(input: CreateProductInput): Promise<DbProduct> {
    return apiFetch<DbProduct>('/api/products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Update product status (DRAFT, PUBLISHED, LOW_STOCK, OUT_OF_STOCK, ARCHIVED)
   */
  async updateProductStatus(id: string, status: ProductStatus): Promise<DbProduct> {
    return apiFetch<DbProduct>(`/api/products/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Delete a product by ID
   */
  async deleteProduct(id: string): Promise<{ id: string; deleted: boolean }> {
    return apiFetch<{ id: string; deleted: boolean }>(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }
}

export const productService = new ProductService();
