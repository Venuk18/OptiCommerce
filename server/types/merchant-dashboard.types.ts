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

export interface MerchantOrderItemData {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  lineTotal: number;
  attributionSource: string;
}

export interface MerchantOrderData {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  paymentStatus: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';
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

