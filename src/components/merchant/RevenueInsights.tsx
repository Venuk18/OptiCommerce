import React, { useEffect, useState, useCallback } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { merchantDashboardService } from '../../services/merchant-dashboard.service';
import { MerchantIntelligenceSummary, MerchantInsight } from '../../types';
import {
  Sparkles,
  PackageCheck,
  Tag,
  RotateCcw,
  TrendingDown,
  ShoppingCart,
  ShoppingBag,
  Info,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Zap,
  ArrowUpRight,
  TrendingUp,
  Activity
} from 'lucide-react';

interface RevenueInsightsProps {
  storeId?: string;
  isStoreLoading?: boolean;
  key?: React.Key;
}

export function RevenueInsights({ storeId: propStoreId, isStoreLoading: propIsStoreLoading }: RevenueInsightsProps) {
  const commerce = useCommerce();
  const activeStoreId = propStoreId || commerce?.store?.id;
  const isStoreLoading = propIsStoreLoading !== undefined ? propIsStoreLoading : (commerce?.isStoreLoading || false);

  const [intelligence, setIntelligence] = useState<MerchantIntelligenceSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    if (!activeStoreId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await merchantDashboardService.getInsights(activeStoreId);
      setIntelligence(data);
    } catch (err: any) {
      console.error('Failed to load merchant revenue insights:', err);
      setError(
        err?.message || 'Unable to load revenue intelligence. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeStoreId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Helper formatter for metric values according to their label context
  const formatMetricValue = (metric: number, label?: string): string => {
    if (typeof metric !== 'number' || isNaN(metric)) return '0';
    const lowerLabel = (label || '').toLowerCase();

    if (lowerLabel.includes('rate') || lowerLabel.includes('ctr') || lowerLabel.includes('share')) {
      return `${metric.toFixed(1)}%`;
    }
    if (lowerLabel.includes('revenue') || lowerLabel.includes('sales')) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(metric);
    }
    return new Intl.NumberFormat('en-IN').format(metric);
  };

  // Helper to render type-specific icons
  const renderInsightIcon = (type: MerchantInsight['type'], severity: MerchantInsight['severity']) => {
    const iconClass = 'w-4 h-4';

    switch (type) {
      case 'ATTRIBUTION_AI':
        return <Sparkles className={iconClass} />;
      case 'BUNDLE_PERFORMANCE':
        return <PackageCheck className={iconClass} />;
      case 'OFFER_PERFORMANCE':
        return <Tag className={iconClass} />;
      case 'RECOVERY_PERFORMANCE':
        return <RotateCcw className={iconClass} />;
      case 'FUNNEL_BOTTLENECK':
        return <TrendingDown className={iconClass} />;
      case 'CHECKOUT_BOTTLENECK':
        return <ShoppingCart className={iconClass} />;
      case 'PRODUCT_OPPORTUNITY':
        return <ShoppingBag className={iconClass} />;
      case 'SYSTEM_STATUS':
      default:
        if (severity === 'WARNING') return <AlertTriangle className={iconClass} />;
        if (severity === 'OPPORTUNITY') return <Zap className={iconClass} />;
        return <Info className={iconClass} />;
    }
  };

  // Helper to retrieve styling tokens based on severity
  const getSeverityStyles = (severity: MerchantInsight['severity']) => {
    switch (severity) {
      case 'WARNING':
        return {
          cardBg: 'bg-amber-50/40 hover:bg-amber-50/70',
          border: 'border-amber-200/90 hover:border-amber-300',
          iconWrapper: 'bg-amber-100/80 text-amber-800',
          badge: 'bg-amber-100 text-amber-900 border-amber-200/80',
          badgeLabel: 'Attention Needed',
          metricBox: 'bg-white/80 border-amber-200 text-amber-950',
          recommendationBox: 'bg-white/90 border-amber-200/80 text-amber-950',
          recommendationLabel: 'text-amber-800',
        };
      case 'OPPORTUNITY':
        return {
          cardBg: 'bg-emerald-50/30 hover:bg-emerald-50/60',
          border: 'border-emerald-200/80 hover:border-emerald-300',
          iconWrapper: 'bg-emerald-100/80 text-emerald-800',
          badge: 'bg-emerald-100 text-emerald-900 border-emerald-200/80',
          badgeLabel: 'Opportunity',
          metricBox: 'bg-white/80 border-emerald-200 text-emerald-950',
          recommendationBox: 'bg-white/90 border-emerald-200/80 text-emerald-950',
          recommendationLabel: 'text-emerald-800',
        };
      case 'INFO':
      default:
        return {
          cardBg: 'bg-slate-50/60 hover:bg-slate-50/90',
          border: 'border-slate-200 hover:border-slate-300',
          iconWrapper: 'bg-blue-50 text-blue-700',
          badge: 'bg-blue-50 text-blue-800 border-blue-200',
          badgeLabel: 'Update',
          metricBox: 'bg-white border-slate-200 text-slate-900',
          recommendationBox: 'bg-white/90 border-slate-200 text-slate-800',
          recommendationLabel: 'text-slate-700',
        };
    }
  };

  const insightsList = intelligence?.insights || [];
  const hasNoInsights = !isLoading && !isStoreLoading && insightsList.length === 0;

  return (
    <div className="space-y-6" id="merchant-revenue-insights">
      {/* Non-blocking Error State */}
      {error && (
        <div
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-rose-900"
          id="insights-error-banner"
        >
          <div className="flex items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold text-sm">Revenue Intelligence Unavailable</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            id="retry-insights-button"
            onClick={() => fetchInsights()}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-sm cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton State */}
      {(isLoading || isStoreLoading) && (
        <div
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6 animate-pulse"
          id="insights-loading-skeleton"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="space-y-2">
              <div className="h-5 w-44 bg-slate-200 rounded-md" />
              <div className="h-3.5 w-64 bg-slate-100 rounded-md" />
            </div>
            <div className="h-6 w-28 bg-slate-100 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="p-5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-3 w-4/5 bg-slate-100 rounded" />
                <div className="h-10 bg-white rounded-lg border border-slate-100" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loaded Revenue Intelligence Container */}
      {!isLoading && !isStoreLoading && intelligence && (
        <div
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6"
          id="insights-container"
        >
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Revenue Intelligence</h2>
                <p className="text-xs text-slate-500">
                  Actionable insights based on your store's commerce activity.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200">
                {insightsList.length} {insightsList.length === 1 ? 'Insight' : 'Insights'} Active
              </span>
            </div>
          </div>

          {/* Zero Insights State */}
          {hasNoInsights && (
            <div
              className="p-6 bg-slate-50 border border-slate-200/80 rounded-xl text-center space-y-2"
              id="insights-zero-state"
            >
              <div className="w-10 h-10 bg-white rounded-full border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                <Activity className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-800">No revenue insights available yet.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Insights will automatically appear as shopper interactions and transactions accumulate.
              </p>
            </div>
          )}

          {/* Insights Grid */}
          {!hasNoInsights && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="insights-grid">
              {insightsList.map((insight) => {
                const styles = getSeverityStyles(insight.severity);
                const hasMetric = typeof insight.metric === 'number';

                return (
                  <div
                    key={insight.id}
                    id={`insight-card-${insight.id}`}
                    className={`rounded-xl border p-5 space-y-4 transition-colors ${styles.cardBg} ${styles.border} flex flex-col justify-between`}
                  >
                    <div className="space-y-3">
                      {/* Top Bar: Icon + Title + Severity Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${styles.iconWrapper}`}
                          >
                            {renderInsightIcon(insight.type, insight.severity)}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 leading-snug">
                              {insight.title}
                            </h3>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border shrink-0 uppercase tracking-wide ${styles.badge}`}
                          id={`insight-badge-${insight.id}`}
                        >
                          {insight.severity}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {insight.description}
                      </p>

                      {/* Optional Metric Highlight */}
                      {hasMetric && (
                        <div
                          className={`p-3 rounded-lg border flex items-center justify-between ${styles.metricBox}`}
                          id={`insight-metric-${insight.id}`}
                        >
                          <span className="text-xs font-medium text-slate-600">
                            {insight.metricLabel || 'Observed Value'}
                          </span>
                          <span className="text-sm font-bold">
                            {formatMetricValue(insight.metric!, insight.metricLabel)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Optional Suggested Action Recommendation */}
                    {insight.recommendation && (
                      <div
                        className={`p-3 rounded-lg border text-xs space-y-1 ${styles.recommendationBox}`}
                        id={`insight-recommendation-${insight.id}`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className={styles.recommendationLabel}>Suggested Action</span>
                        </div>
                        <p className="text-slate-700 leading-normal">
                          {insight.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
