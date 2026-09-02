import React, { useEffect, useState, useCallback } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { merchantDashboardService } from '../../services/merchant-dashboard.service';
import { MerchantDashboardSummaryData } from '../../types';
import { FunnelAnalytics } from './FunnelAnalytics';
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
  CheckCircle2
} from 'lucide-react';

export function RevenueAnalytics() {
  const { store, isStoreLoading, setMerchantTab } = useCommerce();

  const [summary, setSummary] = useState<MerchantDashboardSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      console.error('Failed to load revenue analytics:', err);
      setError(
        err?.message || 'Unable to load revenue analytics. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [store?.id]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const formatCurrency = (amount: number): string => {
    const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(validAmount);
  };

  const formatPercent = (rate: number): string => {
    const validRate = typeof rate === 'number' && !isNaN(rate) ? rate : 0;
    return `${validRate.toFixed(2)}%`;
  };

  const formatInteger = (num: number): string => {
    const validNum = typeof num === 'number' && !isNaN(num) ? num : 0;
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(validNum);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn" id="merchant-revenue-analytics">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Revenue Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative financial metrics and conversion accounting for {store?.name || 'your store'}.
          </p>
        </div>

        <button
          onClick={() => fetchSummary()}
          disabled={isLoading || isStoreLoading || !store}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-rose-900">
          <div className="flex items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold text-sm">Analytics Unavailable</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchSummary()}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-sm cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {(isLoading || isStoreLoading) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-4">
              <div className="h-3 w-28 bg-slate-200 rounded-md" />
              <div className="h-8 w-36 bg-slate-200 rounded-md" />
              <div className="h-3 w-48 bg-slate-100 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Metrics Cards */}
      {!isLoading && !isStoreLoading && summary && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Revenue</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.totalRevenue)}</p>
              <p className="text-xs text-slate-400">Total verified paid orders</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Orders</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatInteger(summary.totalOrders)}</p>
              <p className="text-xs text-slate-400">Confirmed store checkouts</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Order Value</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.averageOrderValue)}</p>
              <p className="text-xs text-slate-400">Gross revenue / paid orders</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Offer Acceptance</span>
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatPercent(summary.offerAcceptanceRate)}</p>
              <p className="text-xs text-slate-400">Accepted dynamic offers</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recovered Sales</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.recoveredSales)}</p>
              <p className="text-xs text-slate-400">Attributable recovered sales</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bundle Revenue</span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <PackageCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.bundleRevenue)}</p>
              <p className="text-xs text-slate-400">Complementary bundle sales</p>
            </div>
          </div>

          {/* Funnel Analytics */}
          <FunnelAnalytics storeId={store?.id} isStoreLoading={isStoreLoading} />

          {/* Revenue Loop Highlight */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">Revenue Loop Accounting</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
              OptiCommerce aggregates revenue strictly from verified, paid orders while tracking conversion touchpoints across discovery, dynamic offers, recovery, and bundle cross-sells.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
