export interface GetBundleSuggestionsInput {
  sessionId: string;
  storeId: string;
  productId: string;
  limit?: number;
}

export interface BundleSuggestionItem {
  productId: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  stock: number;
  image: string;
  reason: string;
  bundleScore: number;
}

export interface BundleSuggestionsResponseData {
  baseProductId: string;
  suggestions: BundleSuggestionItem[];
}

export interface BundleProductSummary {
  id: string;
  name: string;
  category: string;
  brand?: string | null;
  price: number;
  stock: number;
  image?: string;
}

export interface BundleOpportunity {
  bundleId: string;
  bundleName: string;
  products: BundleProductSummary[];
  discountEligible: boolean;
  bundleSummary: string;
  originalTotal: number;
  bundlePrice: number;
  savings: number;
  discountPercent?: number;
}

export interface GetCartCrossSellInput {
  sessionId: string;
  storeId: string;
  focusedProductId?: string;
  query?: string;
  conversationState?: any;
  limit?: number;
  suppressDuplicates?: boolean;
}

export interface CartCrossSellResult {
  hasCartItems: boolean;
  cartStateHash?: string;
  baseProducts: Array<{ id: string; name: string; category: string }>;
  suggestions: BundleSuggestionItem[];
  bundleOpportunity?: BundleOpportunity | null;
  explanation?: string;
}
