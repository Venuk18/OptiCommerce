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
  whyRecommended?: string;
  keyAdvantage?: string;
  tradeoff?: string | null;
  fitRole?: string;
  bestFor?: string;
}

export interface ComparedProductItem {
  productId: string;
  name: string;
  brand?: string | null;
  category: string;
  price: number;
  stock?: number;
  images?: string[];
  features?: string[];
  specifications?: Record<string, any> | null;
  tags?: string[];
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

export type CommercialOfferType =
  | 'NO_OFFER'
  | 'BUNDLE_VALUE'
  | 'SMALL_DISCOUNT'
  | 'TARGETED_OFFER'
  | 'SALE_RECOVERY'
  | 'NON_PRICE_INCENTIVE';

export interface CommercialOffer {
  type: CommercialOfferType;
  productId?: string;
  productName?: string;
  bundleId?: string;
  originalPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  finalPrice?: number;
  reason: string;
  explanation?: string;
  bundleOpportunity?: BundleOpportunity | null;
  recoveryAlternatives?: any[];
  nonPriceIncentive?: string;
  expiresAt?: string;
  token?: string;
}

export interface AIChatTurn {
  id: string;
  userPrompt: string;
  assistantSummary: string;
  highlightNote?: string;
  totalFound?: number;
  recommendedProducts: Product[];
  suggestedFollowUps: string[];
  comparisonData?: ProductComparisonResult;
  crossSell?: CartCrossSellResult;
  bundleOpportunity?: BundleOpportunity | null;
  commercialOffer?: CommercialOffer;
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
  status: 'Processing' | 'Confirmed' | 'Shipped' | 'Delivered';
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

export interface DiscussedProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  position: number;
}

export type ConversationStage =
  | 'DISCOVERY'
  | 'CLARIFYING'
  | 'EVALUATING'
  | 'COMPARING'
  | 'READY_TO_BUY';

export interface ConversationState {
  goal: string | null;
  category: string | null;
  budget: {
    min: number | null;
    max: number | null;
  };
  preferences: string[];
  exclusions: string[];
  useCase: string | null;
  discussedProducts: DiscussedProduct[];
  rejectedProducts: string[];
  selectedProductId: string | null;
  stage: ConversationStage;
  pendingClarification?: {
    question: string;
    options: string[];
  } | null;
}

export const createInitialConversationState = (): ConversationState => ({
  goal: null,
  category: null,
  budget: {
    min: null,
    max: null,
  },
  preferences: [],
  exclusions: [],
  useCase: null,
  discussedProducts: [],
  rejectedProducts: [],
  selectedProductId: null,
  stage: 'DISCOVERY',
  pendingClarification: null,
});

export interface ConversationMessageHistory {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationContextInput {
  history?: ConversationMessageHistory[];
  state?: ConversationState;
}

export type IntentMode =
  | 'NEW_REQUEST'
  | 'FOLLOW_UP_REFINEMENT'
  | 'PRODUCT_QUESTION'
  | 'PRODUCT_REFERENCE'
  | 'COMPARISON_REQUEST'
  | 'DISSATISFACTION'
  | 'CLARIFICATION_ANSWER'
  | 'CROSS_SELL_REQUEST'
  | 'BUNDLE_REQUEST'
  | 'OFFER_REQUEST';

export interface ReferenceResolutionResult {
  resolved: boolean;
  mode: 'single' | 'multiple' | 'invalid' | 'none';
  referencedPositions: number[];
  referencedProductIds: string[];
  unresolvedMessage?: string;
  comparisonAttribute?: string;
}

export interface CustomerIntent {
  category: string | null;
  brand: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  preferences: string[];
  keywords: string[];
  mode?: IntentMode;
  useCase?: string | null;
  targetProductPositions?: number[];
  comparisonAttributes?: string[];
}

export interface RankedRecommendation {
  productId: string;
  rank: number;
  matchScore: number;
  reason: string;
  whyRecommended?: string;
  keyAdvantage?: string;
  tradeoff?: string | null;
  fitRole?: string;
  bestFor?: string;
}

export interface RecommendationResponse {
  query: string;
  intent: CustomerIntent;
  recommendations: RankedRecommendation[];
  products?: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    brand: string | null;
    price: number;
    stock: number;
    images: string[];
    features: string[];
    specifications: Record<string, any> | null;
    tags: string[];
    relevanceScore: number;
  }[];
  message?: string;
  conversationState?: ConversationState;
  mode?: IntentMode;
  resolvedProducts?: DiscussedProduct[];
  crossSell?: CartCrossSellResult;
  bundleOpportunity?: BundleOpportunity | null;
  commercialOffer?: CommercialOffer;
}

export interface RecommendRequestInput {
  storeId: string;
  query: string;
  conversationContext?: ConversationContextInput;
  cartProductIds?: string[];
  focusedProductId?: string;
  sessionId?: string;
}

export interface CompareRequestInput {
  storeId: string;
  productIds: string[];
  conversationState?: ConversationState;
  query?: string;
}

export interface CompareResponse {
  comparison: ProductComparisonResult;
  conversationState: ConversationState;
  message: string;
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

export type CommerceEventType =
  | 'SEARCH'
  | 'RECOMMENDATION_VIEW'
  | 'RECOMMENDATION_CLICK'
  | 'PRODUCT_VIEW'
  | 'ADD_TO_CART'
  | 'REMOVE_FROM_CART'
  | 'CHECKOUT_STARTED'
  | 'OFFER_VIEW'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'PURCHASE';

export interface TrackEventInput {
  storeId: string;
  eventType: CommerceEventType;
  productId?: string | null;
  metadata?: Record<string, any> | null;
}

export interface CommerceEventData {
  id: string;
  sessionId: string;
  storeId: string;
  productId: string | null;
  eventType: CommerceEventType;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

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

export interface PurchaseProbabilityData {
  sessionId: string;
  storeId: string;
  productId: string;
  purchaseProbability: number;
  score: number;
  confidence: ConfidenceLevel;
  signals: BehavioralSignal[];
}

export interface OptimizeRevenueRequest {
  sessionId: string;
  storeId: string;
  productId: string;
}

export interface RevenueOptimizationData {
  productId: string;
  price: number;
  recommendedDiscount: number;
  recommendedPrice: number;
  reason: string;
  purchaseProbability?: number;
  expectedRevenue?: number;
  expectedProfit?: number;
  baselineExpectedProfit?: number;
  improvement?: number;
}

export type OfferState =
  | 'IDLE'
  | 'LOADING'
  | 'AVAILABLE'
  | 'NO_DISCOUNT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ERROR';

export interface CustomerOffer {
  productId: string;
  originalPrice: number;
  discountPercentage: number;
  discountedPrice: number;
  savings: number;
  message: string;
  state: OfferState;
}

export interface RecoverSaleRequest {
  sessionId: string;
  storeId: string;
  rejectedProductId: string;
  userQuery?: string;
  maxBudget?: number;
  limit?: number;
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
  similarityScore: number;
  matchHighlights?: string[];
  priceDifference: number;
  priceComparison: 'cheaper' | 'similar' | 'premium';
}

export interface RecoverSaleResult {
  rejectedProductId: string;
  rejectedProductName: string;
  rejectedProductPrice: number;
  alternatives: ProductAlternativeItem[];
  totalFound: number;
}

export interface ServerCartItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  image: string;
  category: string;
  inStock: boolean;
  availableStock: number;
  status: string;
}

export interface ServerCartData {
  id: string | null;
  sessionId: string;
  storeId: string;
  items: ServerCartItem[];
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
  lastAddedProductId?: string | null;
}

export interface BundleSuggestion {
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
  suggestions: BundleSuggestion[];
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

export interface CartCrossSellResult {
  hasCartItems: boolean;
  cartStateHash?: string;
  baseProducts: Array<{ id: string; name: string; category: string }>;
  suggestions: BundleSuggestion[];
  bundleOpportunity?: BundleOpportunity | null;
  explanation?: string;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type PaymentStatus = 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface ServerOrderItemData {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  lineTotal: number;
}

export interface ServerOrderData {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
  items: ServerOrderItemData[];
}

export interface CreatePaymentOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentResponse {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  razorpayPaymentId: string;
}

export interface MerchantDashboardSummaryData {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  offerAcceptanceRate: number;
  recoveredSales: number;
  bundleRevenue: number;
}

export interface MerchantDashboardSummaryResponse {
  success: boolean;
  data: MerchantDashboardSummaryData;
}

export interface MerchantFunnelSummaryData {
  recommendationViews: number;
  recommendationClicks: number;
  recommendationClickRate: number;
  productViews: number;
  addToCartEvents: number;
  addToCartRate: number;
  checkoutStarted: number;
  purchases: number;
  checkoutConversionRate: number;
  offerViews: number;
  offerAccepted: number;
  offerAcceptanceRate: number;
}

export interface MerchantFunnelSummaryResponse {
  success: boolean;
  data: MerchantFunnelSummaryData;
}

export interface AttributionBreakdownItem {
  source: 'DIRECT' | 'AI_CHAT' | 'BUNDLE' | 'OFFER' | 'RECOVERY';
  revenue: number;
}

export interface MerchantAttributionSummaryData {
  totalAttributedRevenue: number;
  aiInfluencedRevenue: number;
  aiInfluencedShare: number;
  offerRevenue: number;
  recoveredRevenue: number;
  bundleRevenue: number;
  directRevenue: number;
  attributionBreakdown: AttributionBreakdownItem[];
}

export interface MerchantAttributionSummaryResponse {
  success: boolean;
  data: MerchantAttributionSummaryData;
}

export interface MerchantInsight {
  id: string;
  type:
    | 'ATTRIBUTION_AI'
    | 'BUNDLE_PERFORMANCE'
    | 'OFFER_PERFORMANCE'
    | 'RECOVERY_PERFORMANCE'
    | 'FUNNEL_BOTTLENECK'
    | 'CHECKOUT_BOTTLENECK'
    | 'PRODUCT_OPPORTUNITY'
    | 'SYSTEM_STATUS';
  severity: 'INFO' | 'OPPORTUNITY' | 'WARNING';
  title: string;
  description: string;
  metric?: number;
  metricLabel?: string;
  recommendation?: string;
  createdAt: string;
}

export interface MerchantIntelligenceSummary {
  storeId: string;
  generatedAt: string;
  insights: MerchantInsight[];
  metricsSnapshot: {
    totalRevenue: number;
    aiInfluencedShare: number;
    checkoutConversionRate: number;
    offerAcceptanceRate: number;
  };
}

export interface MerchantIntelligenceResponse {
  success: boolean;
  data: MerchantIntelligenceSummary;
}

export interface SafeMerchantStore {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SafeMerchant {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
  store: SafeMerchantStore | null;
}

export interface AuthResult {
  merchant: SafeMerchant;
  token: string;
}

export interface MerchantOrderItemData {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  lineTotal: number;
  attributionSource: 'DIRECT' | 'AI_CHAT' | 'BUNDLE' | 'OFFER' | 'RECOVERY';
}

export interface MerchantOrderData {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  items: MerchantOrderItemData[];
}

export interface MerchantOrdersData {
  orders: MerchantOrderData[];
  pagination: {
    page: number;
    limit: number;
    totalOrders: number;
    totalPages: number;
  };
  counts: {
    all: number;
    readyToProcess: number;
    pendingPayment: number;
    cancelled: number;
  };
}

export interface MerchantOrdersResponse {
  success: boolean;
  data: MerchantOrdersData;
}

export interface MerchantOrderDetailResponse {
  success: boolean;
  data: MerchantOrderData;
}

export interface SafeCustomer {
  id: string;
  storeId: string;
  name: string | null;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerAuthResult {
  customer: SafeCustomer;
  token: string;
}
