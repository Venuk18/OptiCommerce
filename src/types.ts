export interface Product {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  costPrice: number;
  marginPercent: number;
  stock: number;
  rating: number;
  ratingCount: number;
  image: string;
  description: string;
  matchScore?: number;
  matchReason?: string;
  matchBadge?: string;
  matchBadgeColor?: 'blue' | 'purple' | 'emerald';
  matchHighlightQuote?: string;
  matchHighlightType?: 'check' | 'info';
  tags: string[];
  aiDiscountEligible: boolean;
  activeDiscountPercent: number;
  isLive: boolean;
  specs?: Record<string, string>;
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
