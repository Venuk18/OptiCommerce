import React, { useEffect, useState, useCallback } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { merchantDashboardService } from '../../services/merchant-dashboard.service';
import { MerchantDashboardSummaryData } from '../../types';
import { FunnelAnalytics } from './FunnelAnalytics';
import { RevenueInsights } from './RevenueInsights';
import { 
  TrendingUp, 
  ShoppingBag, 
  Percent, 
  RotateCcw, 
  PackageCheck, 
  Sparkles, 
  Layers, 
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

export function Dashboard() {
  const { store, isStoreLoading, setMerchantTab } = useCommerce();

  const [summary, setSummary] = useState<MerchantDashboardSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const fetchSummary = useCallback(async () => {
    if (!store?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await merchantDashboardService.getSummary(store.id);
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load merchant dashboard metrics:', err);
      setError(
        err?.message || 'Unable to load revenue dashboard metrics. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [store?.id]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Helper formatter for INR currency
  const formatCurrency = (amount: number): string => {
    const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(validAmount);
  };

  // Helper formatter for percentages
  const formatPercent = (rate: number): string => {
    const validRate = typeof rate === 'number' && !isNaN(rate) ? rate : 0;
    return `${validRate.toFixed(2)}%`;
  };

  // Helper formatter for integer order counts
  const formatInteger = (num: number): string => {
    const validNum = typeof num === 'number' && !isNaN(num) ? num : 0;
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(validNum);
  };

  const isZeroState = summary && summary.totalOrders === 0 && summary.totalRevenue === 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn" id="merchant-revenue-dashboard">
      {/* Dashboard Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Revenue Dashboard</h1>
            {store && (
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">
                {store.name}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            OptiCommerce helps merchants convert more shoppers and recover more revenue.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="refresh-dashboard-button"
            onClick={handleRefresh}
            disabled={isLoading || isStoreLoading || !store}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Error UX State with Non-blocking Retry */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-rose-900" id="dashboard-error-banner">
          <div className="flex items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold text-sm">Dashboard Data Unavailable</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchSummary()}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-sm cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Missing Store State */}
      {!isStoreLoading && !store && !isLoading && (
        <div className="p-8 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-3" id="missing-store-banner">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
          <h2 className="text-base font-bold text-amber-900">No Active Store Selected</h2>
          <p className="text-xs text-amber-700 max-w-md mx-auto">
            Please select or configure your merchant store in Store Management to view live revenue analytics.
          </p>
          <button
            onClick={() => setMerchantTab('store-management')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            Open Store Management
          </button>
        </div>
      )}

      {/* Loading Skeleton State */}
      {(isLoading || isStoreLoading) && (
        <div className="space-y-8" id="dashboard-loading-skeleton">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3 w-28 bg-slate-200 rounded-md" />
                  <div className="w-8 h-8 bg-slate-100 rounded-lg" />
                </div>
                <div className="h-8 w-36 bg-slate-200 rounded-md" />
                <div className="h-3 w-48 bg-slate-100 rounded-md" />
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-4">
            <div className="h-5 w-48 bg-slate-200 rounded-md" />
            <div className="h-4 w-full bg-slate-100 rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-slate-50 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live KPI Cards (Section 6F.2) */}
      {!isLoading && !isStoreLoading && summary && (
        <div className="space-y-8" id="dashboard-metrics-container">
          {/* 6 Revenue KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Total Revenue */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition-colors" id="kpi-card-total-revenue">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Total Revenue
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight" id="metric-total-revenue">
                  {formatCurrency(summary.totalRevenue)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Confirmed & paid orders</p>
              </div>
            </div>

            {/* Card 2: Total Orders */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition-colors" id="kpi-card-total-orders">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Orders
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight" id="metric-total-orders">
                  {formatInteger(summary.totalOrders)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Total completed checkouts</p>
              </div>
            </div>

            {/* Card 3: Average Order Value */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition-colors" id="kpi-card-average-order-value">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Average Order Value
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight" id="metric-average-order-value">
                  {formatCurrency(summary.averageOrderValue)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Revenue per completed order</p>
              </div>
            </div>

            {/* Card 4: Offer Acceptance Rate */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition-colors" id="kpi-card-offer-acceptance-rate">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Offer Acceptance
                </span>
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight" id="metric-offer-acceptance-rate">
                  {formatPercent(summary.offerAcceptanceRate)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Accepted personalized offers</p>
              </div>
            </div>

            {/* Card 5: Recovered Sales */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition-colors" id="kpi-card-recovered-sales">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Recovered Sales
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight" id="metric-recovered-sales">
                  {formatCurrency(summary.recoveredSales)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Rescued checkout & cart intent</p>
              </div>
            </div>

            {/* Card 6: Bundle Revenue */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition-colors" id="kpi-card-bundle-revenue">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Bundle Revenue
                </span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <PackageCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight" id="metric-bundle-revenue">
                  {formatCurrency(summary.bundleRevenue)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Complementary cross-sell purchases</p>
              </div>
            </div>
          </div>

          {/* Phase 6H — Revenue Intelligence & Actionable Insights */}
          <RevenueInsights
            storeId={store?.id}
            isStoreLoading={isStoreLoading}
            key={`insights-${store?.id}-${refreshKey}`}
          />

          {/* Phase 6G.2 — Commerce Funnel & Offer Performance */}
          <FunnelAnalytics
            storeId={store?.id}
            isStoreLoading={isStoreLoading}
            key={`funnel-${store?.id}-${refreshKey}`}
          />

          {/* Zero-Data Friendly State (Section 6F.5) */}
          {isZeroState && (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3" id="zero-data-state-banner">
              <div className="w-12 h-12 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Your revenue dashboard will appear here as orders come in.</h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                Once shoppers browse your storefront, accept dynamic offers, or complete purchases, live revenue, average order value, and conversion statistics will automatically populate this dashboard.
              </p>
            </div>
          )}

          {/* Merchant Value Highlight — Section 6F.3 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6" id="revenue-optimization-loop-section">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Revenue Optimization</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                Customers discovered through AI recommendations, personalized offers, sale recovery, and complementary bundles contribute to merchant revenue.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Discovery & Recommendations</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Natural language search matches shopper intent to relevant products in your catalog.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />
                  <span>Personalized Offers</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Dynamic, margin-constrained discount incentives that convert price-sensitive shoppers.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Sale Recovery</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Intelligent cart and checkout interventions rescuing shoppers with high purchase intent.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>Complementary Bundles</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Contextual product bundles that lift basket size and increase Average Order Value.
                </p>
              </div>
            </div>
          </div>

          {/* Section 6F.4 — Recent Orders Status Note */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-600" id="recent-orders-deferral-notice">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-800">Merchant Order Ledger</p>
                <p className="text-slate-500 mt-0.5">
                  Live revenue metrics are aggregated directly from verified payment records. Full merchant order management ledger is scheduled for a future release.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg font-semibold text-[11px] shrink-0">
              Aggregated Analytics Live
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
