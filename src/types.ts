export interface Product {
  id: string;
  name: string;
  category: string;
  brand?: string | null;
  basePrice: number;
  costPrice: number;
  marginPercent: number;
  stock: number;
  rating: number;
  ratingCount: number;
  image: string;
  images?: string[];
  description: string;
  features?: string[];
  specifications?: Record<string, any> | null;
  specs?: Record<string, string>;
  tags: string[];
  status?: ProductStatus;
  storeId?: string;
  aiDiscountEligible: boolean;
  activeDiscountPercent: number;
  isLive: boolean;
  matchScore?: number;
  matchReason?: string;
  matchBadge?: string;
  matchBadgeColor?: 'blue' | 'purple' | 'emerald';
  matchHighlightQuote?: string;
  matchHighlightType?: 'check' | 'info';
}

export interface AIChatTurn {
  id: string;
  userPrompt: string;
  assistantSummary: string;
  highlightNote?: string;
  totalFound?: number;
  recommendedProducts: Product[];
  suggestedFollowUps: string[];
}

export interface AIConstraints {
  maxDiscountLimit: number; // e.g. 15%
  minProfitMarginFloor: number; // e.g. 20%
  allowPersonalizedDiscounts: boolean;
  smartUpselling: boolean;
  crossSellingIntelligence: boolean;
  aiProductAlternatives: boolean;
  exitIntentIncentives: boolean;
}

export interface SimulationContext {
  targetProfileName: string;
  targetProfileType: string;
  targetProfileNotes: string;
  activeCartItemId: string;
  calculatedPurchaseIntent: number; // 0-100%
  intentSummary: string;
}

export interface SimulationOutcome {
  id: string;
  discountPercent: number;
  label: string;
  isOptimal?: boolean;
  estConversionRate: number;
  conversionLift?: string;
  expectedRevenue: number;
  marginErosionWarning?: boolean;
  description?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  appliedDiscountPercent: number;
  discountReason?: string;
}

export interface CustomerOrder {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  status: 'Processing' | 'Shipped' | 'Delivered';
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  aiSavings: number;
}

export type StoreStatus = 'PUBLISHED' | 'UNPUBLISHED';

export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'ARCHIVED';

export interface DbProduct {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  category: string;
  brand: string | null;
  price: number | string;
  costPrice: number | string;
  stock: number;
  images: string[];
  features: string[];
  specifications: Record<string, any> | null;
  tags: string[];
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  store?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
}

export interface GetProductsFilter {
  storeId?: string;
  category?: string;
  status?: string;
}

export interface CreateProductInput {
  storeId: string;
  name: string;
  description?: string | null;
  category: string;
  brand?: string | null;
  price: number | string;
  costPrice: number | string;
  stock?: number;
  images?: string[];
  features?: string[];
  specifications?: Record<string, any> | null;
  tags?: string[];
  status?: ProductStatus | string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  category?: string;
  brand?: string | null;
  price?: number | string;
  costPrice?: number | string;
  stock?: number;
  images?: string[];
  features?: string[];
  specifications?: Record<string, any> | null;
  tags?: string[];
  status?: ProductStatus | string;
}

export interface Store {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  description: string | null;
  status: StoreStatus;
  createdAt: string;
  updatedAt: string;
  merchant?: Merchant;
}

export interface Merchant {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  store?: Store | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
  };
}

export interface CreateMerchantInput {
  name: string;
  email: string;
}

export interface CreateStoreInput {
  merchantId: string;
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateStoreInput {
  name?: string;
  slug?: string;
  description?: string | null;
}
