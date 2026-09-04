export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type SignalImpact =
  | 'low_positive'
  | 'positive'
  | 'strong_positive'
  | 'very_strong_positive'
  | 'negative'
  | 'strong_negative';

export interface BehavioralSignal {
  event: string;
  impact: SignalImpact;
  count?: number;
  description?: string;
}

export interface PurchaseProbabilityRequest {
  sessionId: string;
  storeId: string;
  productId: string;
}

export interface PurchaseProbabilityResult {
  sessionId: string;
  storeId: string;
  productId: string;
  purchaseProbability: number; // 0.0 to 1.0 (rounded to 2 decimal places)
  score: number; // 0 to 100
  confidence: ConfidenceLevel;
  signals: BehavioralSignal[];
}

export interface OptimizeRevenueRequest {
  sessionId: string;
  storeId: string;
  productId: string;
}

export interface CandidateDiscountEvaluation {
  discount: number; // Percentage, e.g. 0, 5, 10, 15
  discountedPrice: number;
  unitProfit: number;
  purchaseProbability: number;
  expectedRevenue: number;
  expectedProfit: number;
  valid: boolean;
  invalidReason?: string;
}

export interface RevenueOptimizationResult {
  productId: string;
  price: number;
  costPrice: number; // Internal only
  purchaseProbability: number;
  recommendedDiscount: number;
  recommendedPrice: number;
  expectedRevenue: number;
  expectedProfit: number;
  baselineExpectedProfit: number;
  improvement: number;
  reason: string;
  evaluations: CandidateDiscountEvaluation[]; // Detailed internal analysis
}

export interface CustomerRevenueOptimizationResponse {
  productId: string;
  price: number;
  recommendedDiscount: number;
  recommendedPrice: number;
  reason: string;
}

export interface RecoverSaleRequest {
  sessionId: string;
  storeId: string;
  rejectedProductId: string;
  userQuery?: string;
  maxBudget?: number;
  limit?: number; // default 3, max 5
}

export interface ProductAlternativeItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  brand: string | null;
  price: number;
  stock: number;
  images: string[];
  features: string[];
  tags: string[];
  status: string;
  similarityScore: number; // 0 to 1
  matchHighlights?: string[];
  priceDifference: number; // alternativePrice - rejectedPrice
  priceComparison: 'cheaper' | 'similar' | 'premium';
}

export interface RecoverSaleResult {
  rejectedProductId: string;
  rejectedProductName: string;
  rejectedProductPrice: number;
  alternatives: ProductAlternativeItem[];
  totalFound: number;
}
