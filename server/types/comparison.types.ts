import { ConversationState } from './recommendation.types';

export interface ComparedProductItem {
  productId: string;
  name: string;
  brand: string | null;
  category: string;
  price: number;
  stock: number;
  images: string[];
  features: string[];
  specifications: Record<string, any> | null;
  tags: string[];
  strengths: string[];
  weaknesses: string[];
  tradeoff?: string;
  fitSummary?: string;
}

export interface ProductComparisonResult {
  products: ComparedProductItem[];
  winnerProductId: string | null;
  winnerReason: string;
  tradeoffs: string;
}

export interface CompareProductsInput {
  storeId: string;
  productIds: string[];
  conversationState?: ConversationState;
  query?: string;
}

export interface CompareProductsResult {
  comparison: ProductComparisonResult;
  conversationState: ConversationState;
  message: string;
}
