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

