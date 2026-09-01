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
