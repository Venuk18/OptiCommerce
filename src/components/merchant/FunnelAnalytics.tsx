import React, { useEffect, useState, useCallback } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { merchantDashboardService } from '../../services/merchant-dashboard.service';
import { MerchantFunnelSummaryData } from '../../types';
import {
  Eye,
  MousePointerClick,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  CheckCircle2,
  Tag,
  Percent,
  AlertCircle,
  RefreshCw,
  ArrowDown,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Zap
} from 'lucide-react';

interface FunnelAnalyticsProps {
  storeId?: string;
  isStoreLoading?: boolean;
  key?: React.Key;
}

export function FunnelAnalytics({ storeId: propStoreId, isStoreLoading: propIsStoreLoading }: FunnelAnalyticsProps) {
  const commerce = useCommerce();
  const activeStoreId = propStoreId || commerce?.store?.id;
  const isStoreLoading = propIsStoreLoading !== undefined ? propIsStoreLoading : (commerce?.isStoreLoading || false);

  const [funnel, setFunnel] = useState<MerchantFunnelSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFunnel = useCallback(async () => {
    if (!activeStoreId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await merchantDashboardService.getFunnel(activeStoreId);
      setFunnel(data);
    } catch (err: any) {
      console.error('Failed to load merchant funnel analytics:', err);
      setError(
        err?.message || 'Unable to load funnel analytics. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeStoreId]);

  useEffect(() => {
    fetchFunnel();
  }, [fetchFunnel]);

  // Helper formatter for percentages using authoritative backend values
  const formatPercent = (rate: number): string => {
    const validRate = typeof rate === 'number' && !isNaN(rate) ? rate : 0;
    return `${validRate.toFixed(2)}%`;
  };

  // Helper formatter for integer event counts
  const formatInteger = (num: number): string => {
    const validNum = typeof num === 'number' && !isNaN(num) ? num : 0;
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(validNum);
  };

  const isZeroState =
    funnel &&
    funnel.recommendationViews === 0 &&
    funnel.recommendationClicks === 0 &&
    funnel.productViews === 0 &&
    funnel.addToCartEvents === 0 &&
    funnel.checkoutStarted === 0 &&
    funnel.purchases === 0 &&
    funnel.offerViews === 0 &&
    funnel.offerAccepted === 0;

  return (
    <div className="space-y-8" id="merchant-funnel-analytics">
      {/* Funnel Error State with Non-blocking Retry */}
      {error && (
        <div
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-rose-900"
          id="funnel-error-banner"
        >
          <div className="flex items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold text-sm">Funnel Analytics Unavailable</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            id="retry-funnel-button"
            onClick={() => fetchFunnel()}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-sm cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton State */}
      {(isLoading || isStoreLoading) && (
        <div className="space-y-6" id="funnel-loading-skeleton">
          {/* Main Funnel Skeleton */}
          <div className="bg-white p-6 lg:p-8 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="h-5 w-44 bg-slate-200 rounded-md" />
              <div className="h-4 w-64 bg-slate-100 rounded-md" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((step) => (
                <div key={step} className="p-5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-4">
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                  <div className="space-y-3">
                    <div className="h-10 bg-white rounded-lg border border-slate-100" />
                    <div className="h-10 bg-white rounded-lg border border-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Offer Performance Skeleton */}
          <div className="bg-white p-6 lg:p-8 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-4">
            <div className="h-5 w-40 bg-slate-200 rounded-md" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-20 bg-slate-50 rounded-xl border border-slate-100" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loaded Funnel View */}
      {!isLoading && !isStoreLoading && funnel && (
        <div className="space-y-8" id="funnel-metrics-container">
          {/* Section 6G.2.2 — Primary Commerce Funnel */}
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6"
            id="commerce-funnel-section"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Commerce Funnel</h2>
                  <p className="text-xs text-slate-500">
                    Track shopper progression from discovery to completed purchases.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200">
                End-to-End Conversion
              </span>
            </div>

            {/* Zero State Notice */}
            {isZeroState && (
              <div
                className="p-6 bg-slate-50 border border-slate-200/80 rounded-xl text-center space-y-2"
                id="funnel-zero-state"
              >
                <div className="w-10 h-10 bg-white rounded-full border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-800">No customer interactions recorded yet</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Funnel data will appear as customers interact with recommendations, browse products, add items to cart, and checkout.
                </p>
              </div>
            )}

            {/* 3-Stage Connected Funnel Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* Stage 1: Recommendation Engagement */}
              <div
                className="bg-slate-50/60 rounded-xl p-5 border border-slate-200/80 space-y-4 hover:border-blue-200 transition-colors"
                id="funnel-stage-recommendation"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Discovery Stage
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">Recommendation engagement</span>
                </div>

                <div className="space-y-3">
                  {/* Metric: Recommendation Views */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/60 shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Eye className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium text-slate-700">Recommendation Views</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900" id="metric-recommendation-views">
                      {formatInteger(funnel.recommendationViews)}
                    </span>
                  </div>

                  {/* Flow Arrow & Conversion Rate */}
                  <div className="flex items-center justify-between px-2 py-0.5">
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <ArrowDown className="w-3.5 h-3.5 md:hidden" />
                      <ArrowRight className="w-3.5 h-3.5 hidden md:block" />
                      <span className="text-[10px] uppercase font-semibold text-slate-400">Click-through</span>
                    </div>
                    <span
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-bold border border-blue-100"
                      id="metric-recommendation-click-rate"
                    >
                      {formatPercent(funnel.recommendationClickRate)} CTR
                    </span>
                  </div>

                  {/* Metric: Recommendation Clicks */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/60 shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                        <MousePointerClick className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium text-slate-700">Recommendation Clicks</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900" id="metric-recommendation-clicks">
                      {formatInteger(funnel.recommendationClicks)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stage 2: Product & Cart Intent */}
              <div
                className="bg-slate-50/60 rounded-xl p-5 border border-slate-200/80 space-y-4 hover:border-violet-200 transition-colors"
                id="funnel-stage-product-cart"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Evaluation Stage
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">Product engagement</span>
                </div>

                <div className="space-y-3">
                  {/* Metric: Product Views */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/60 shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-violet-50 text-violet-600 flex items-center justify-center">
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium text-slate-700">Product Views</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900" id="metric-product-views">
                      {formatInteger(funnel.productViews)}
                    </span>
                  </div>

                  {/* Flow Arrow & Conversion Rate */}
                  <div className="flex items-center justify-between px-2 py-0.5">
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <ArrowDown className="w-3.5 h-3.5 md:hidden" />
                      <ArrowRight className="w-3.5 h-3.5 hidden md:block" />
                      <span className="text-[10px] uppercase font-semibold text-slate-400">Cart Intent</span>
                    </div>
                    <span
                      className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-md text-xs font-bold border border-violet-100"
                      id="metric-add-to-cart-rate"
                    >
                      {formatPercent(funnel.addToCartRate)}
                    </span>
                  </div>

                  {/* Metric: Add to Cart */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/60 shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-violet-50 text-violet-600 flex items-center justify-center">
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium text-slate-700">Add to Cart</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900" id="metric-add-to-cart-events">
                      {formatInteger(funnel.addToCartEvents)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stage 3: Checkout & Purchase Completion */}
              <div
                className="bg-slate-50/60 rounded-xl p-5 border border-slate-200/80 space-y-4 hover:border-emerald-200 transition-colors"
                id="funnel-stage-checkout-purchase"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Conversion Stage
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">Checkout completion</span>
                </div>

                <div className="space-y-3">
                  {/* Metric: Checkout Started */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/60 shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium text-slate-700">Checkout Started</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900" id="metric-checkout-started">
                      {formatInteger(funnel.checkoutStarted)}
                    </span>
                  </div>

                  {/* Flow Arrow & Conversion Rate */}
                  <div className="flex items-center justify-between px-2 py-0.5">
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <ArrowDown className="w-3.5 h-3.5 md:hidden" />
                      <ArrowRight className="w-3.5 h-3.5 hidden md:block" />
                      <span className="text-[10px] uppercase font-semibold text-slate-400">Checkout Conv.</span>
                    </div>
                    <span
                      className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-bold border border-emerald-100"
                      id="metric-checkout-conversion-rate"
                    >
                      {formatPercent(funnel.checkoutConversionRate)}
                    </span>
                  </div>

                  {/* Metric: Purchases */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/60 shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium text-slate-700">Purchases</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900" id="metric-purchases">
                      {formatInteger(funnel.purchases)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 6G.2.3 — Offer Performance Section */}
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6"
            id="offer-performance-section"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Offer Performance</h2>
                  <p className="text-xs text-slate-500">
                    Engagement and acceptance metrics for personalized dynamic incentives.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-semibold border border-violet-100">
                Incentive Conversion
              </span>
            </div>

            {/* Offer Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Card 1: Offer Views */}
              <div
                className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-2 hover:border-slate-300 transition-colors"
                id="offer-card-views"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Offer Views
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 tracking-tight" id="metric-offer-views">
                    {formatInteger(funnel.offerViews)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Dynamic offers displayed to shoppers</p>
                </div>
              </div>

              {/* Card 2: Offers Accepted */}
              <div
                className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-2 hover:border-slate-300 transition-colors"
                id="offer-card-accepted"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Offers Accepted
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 tracking-tight" id="metric-offer-accepted">
                    {formatInteger(funnel.offerAccepted)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Discounts claimed and applied</p>
                </div>
              </div>

              {/* Card 3: Acceptance Rate */}
              <div
                className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-2 hover:border-slate-300 transition-colors"
                id="offer-card-rate"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Acceptance Rate
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 tracking-tight" id="metric-offer-acceptance-rate">
                    {formatPercent(funnel.offerAcceptanceRate)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Accepted offers / total offer impressions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
