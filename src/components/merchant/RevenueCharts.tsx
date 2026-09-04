import React, { useState } from 'react';
import { MerchantOrderData, MerchantAttributionSummaryData } from '../../types';
import {
  TrendingUp,
  BarChart3,
  Package,
  PieChart,
  Layers,
  Sparkles,
  CheckCircle2,
  Info
} from 'lucide-react';

interface RevenueChartsProps {
  orders: MerchantOrderData[];
  attribution: MerchantAttributionSummaryData | null;
  isLoading: boolean;
}

const ATTRIBUTION_CONFIG: Record<string, { label: string; color: string; bgClass: string; textClass: string }> = {
  DIRECT: {
    label: 'Direct Storefront',
    color: '#64748B', // slate-500
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
  },
  AI_CHAT: {
    label: 'AI Shopping Assistant',
    color: '#2563EB', // blue-600
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
  },
  BUNDLE: {
    label: 'Bundle Cross-Sell',
    color: '#4F46E5', // indigo-600
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
  },
  OFFER: {
    label: 'Dynamic Offer Interventions',
    color: '#059669', // emerald-600
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
  },
  RECOVERY: {
    label: 'Exit Intent & Recovery',
    color: '#D97706', // amber-600
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
};

export function RevenueCharts({ orders, attribution, isLoading }: RevenueChartsProps) {
  const [hoveredRevenuePoint, setHoveredRevenuePoint] = useState<{
    x: number;
    y: number;
    label: string;
    value: number;
    orderId?: string;
  } | null>(null);

  const [hoveredOrderBar, setHoveredOrderBar] = useState<{
    label: string;
    count: number;
    amount: number;
  } | null>(null);

  const formatINR = (val: number) => {
    const valid = typeof val === 'number' && !isNaN(val) ? val : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(valid);
  };

  const formatCompactINR = (val: number) => {
    const valid = typeof val === 'number' && !isNaN(val) ? val : 0;
    if (valid >= 10000000) return `₹${(valid / 10000000).toFixed(1)}Cr`;
    if (valid >= 100000) return `₹${(valid / 100000).toFixed(1)}L`;
    if (valid >= 1000) return `₹${(valid / 1000).toFixed(1)}k`;
    return `₹${valid}`;
  };

  // -------------------------------------------------------------
  // Data Preparation: Filter paid orders strictly per application semantics
  // -------------------------------------------------------------
  const paidOrders = orders.filter(
    (o) => o.status === 'CONFIRMED' && o.paymentStatus === 'PAID'
  );

  // Chronological sort
  const sortedPaidOrders = [...paidOrders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Top Products aggregated from authentic paid order items
  const productRevenueMap = new Map<string, { id: string; name: string; revenue: number; quantity: number }>();
  for (const order of paidOrders) {
    for (const item of order.items || []) {
      const pid = item.productId || item.id || 'unknown';
      const name = item.productName || 'Product';
      const lineTotal = Number(item.lineTotal) || 0;
      const qty = Number(item.quantity) || 1;

      const existing = productRevenueMap.get(pid);
      if (existing) {
        existing.revenue += lineTotal;
        existing.quantity += qty;
      } else {
        productRevenueMap.set(pid, { id: pid, name, revenue: lineTotal, quantity: qty });
      }
    }
  }
  const topProducts = Array.from(productRevenueMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const maxProductRevenue = topProducts.length > 0 ? Math.max(...topProducts.map((p) => p.revenue), 1) : 1;

  // -------------------------------------------------------------
  // Chart 1: Revenue Timeline points (Cumulative or Transactional)
  // -------------------------------------------------------------
  const revenuePoints: { label: string; date: string; amount: number; orderId: string }[] = [];
  let runningTotal = 0;

  for (const order of sortedPaidOrders) {
    runningTotal += Number(order.total) || 0;
    const dateObj = new Date(order.createdAt);
    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    revenuePoints.push({
      label: `${dateStr}, ${timeStr}`,
      date: dateStr,
      amount: runningTotal,
      orderId: order.id,
    });
  }

  // SVG dimensions for Revenue Line Chart
  const svgWidth = 640;
  const svgHeight = 220;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;
  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  const maxRev = revenuePoints.length > 0 ? Math.max(...revenuePoints.map((p) => p.amount)) : 10000;
  const yMax = maxRev > 0 ? Math.ceil(maxRev * 1.15) : 10000;

  const getX = (idx: number, total: number) => {
    if (total <= 1) return padLeft + chartWidth / 2;
    return padLeft + (idx / (total - 1)) * chartWidth;
  };

  const getY = (amount: number) => {
    return padTop + chartHeight - (amount / yMax) * chartHeight;
  };

  // Build SVG Path
  let revenuePathD = '';
  let revenueAreaD = '';
  if (revenuePoints.length === 1) {
    const x = getX(0, 1);
    const y = getY(revenuePoints[0].amount);
    revenuePathD = `M ${padLeft},${y} L ${padLeft + chartWidth},${y}`;
    revenueAreaD = `M ${padLeft},${y} L ${padLeft + chartWidth},${y} L ${padLeft + chartWidth},${padTop + chartHeight} L ${padLeft},${padTop + chartHeight} Z`;
  } else if (revenuePoints.length > 1) {
    const coords = revenuePoints.map((p, i) => ({ x: getX(i, revenuePoints.length), y: getY(p.amount) }));
    revenuePathD = `M ${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      revenuePathD += ` L ${coords[i].x},${coords[i].y}`;
    }
    revenueAreaD = `${revenuePathD} L ${coords[coords.length - 1].x},${padTop + chartHeight} L ${coords[0].x},${padTop + chartHeight} Z`;
  }

  // -------------------------------------------------------------
  // Chart 2: Orders by Date / Time Bucket
  // -------------------------------------------------------------
  const ordersByDateMap = new Map<string, { date: string; count: number; amount: number }>();
  for (const order of sortedPaidOrders) {
    const dateObj = new Date(order.createdAt);
    const key = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const existing = ordersByDateMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.amount += Number(order.total) || 0;
    } else {
      ordersByDateMap.set(key, { date: key, count: 1, amount: Number(order.total) || 0 });
    }
  }
  const orderBars = Array.from(ordersByDateMap.values());
  const maxOrderCount = orderBars.length > 0 ? Math.max(...orderBars.map((b) => b.count)) : 1;

  // -------------------------------------------------------------
  // Chart 4: Attribution Donut Math
  // -------------------------------------------------------------
  const attributionItems = (attribution?.attributionBreakdown || []).filter((item) => item.revenue > 0);
  const totalAttributed = attribution?.totalAttributedRevenue || attributionItems.reduce((s, i) => s + i.revenue, 0);

  // SVG Donut radius & circumference
  const donutR = 48;
  const donutC = 2 * Math.PI * donutR;
  let cumulativePercent = 0;
  const donutSegments = attributionItems.map((item) => {
    const share = totalAttributed > 0 ? item.revenue / totalAttributed : 0;
    const strokeDasharray = `${(share * donutC).toFixed(2)} ${(donutC * (1 - share)).toFixed(2)}`;
    const strokeDashoffset = (-cumulativePercent * donutC).toFixed(2);
    cumulativePercent += share;
    return {
      source: item.source,
      revenue: item.revenue,
      share: share * 100,
      config: ATTRIBUTION_CONFIG[item.source] || ATTRIBUTION_CONFIG.DIRECT,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  // -------------------------------------------------------------
  // Loading Skeleton
  // -------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-4">
          <div className="h-5 w-48 bg-slate-200 rounded-md" />
          <div className="h-56 bg-slate-100 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-4">
            <div className="h-5 w-40 bg-slate-200 rounded-md" />
            <div className="h-44 bg-slate-100 rounded-xl" />
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-4">
            <div className="h-5 w-40 bg-slate-200 rounded-md" />
            <div className="h-44 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="revenue-charts-section">
      {/* -------------------------------------------------------- */}
      {/* 1. REVENUE TREND (NATIVE SVG AREA/LINE CHART)             */}
      {/* -------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Revenue Trajectory</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cumulative verified revenue across confirmed orders (sole source: database ledger)
            </p>
          </div>
          {revenuePoints.length > 0 && (
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Latest Total</span>
              <p className="text-lg font-bold text-slate-900">{formatINR(revenuePoints[revenuePoints.length - 1].amount)}</p>
            </div>
          )}
        </div>

        {revenuePoints.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Info className="w-6 h-6 mx-auto text-slate-400" />
            <p className="text-xs font-semibold text-slate-600">No verified paid revenue recorded yet</p>
            <p className="text-[11px] text-slate-400">
              Completed checkouts will dynamically populate this cumulative trajectory.
            </p>
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto min-w-[500px]"
              aria-label="Revenue Trend Line Chart"
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Y-Axis Grid Lines & Labels */}
              {[0, 0.33, 0.66, 1].map((ratio) => {
                const yVal = padTop + chartHeight * (1 - ratio);
                const amountVal = yMax * ratio;
                return (
                  <g key={ratio}>
                    <line
                      x1={padLeft}
                      y1={yVal}
                      x2={padLeft + chartWidth}
                      y2={yVal}
                      stroke="#E2E8F0"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 8}
                      y={yVal + 3}
                      textAnchor="end"
                      fontSize="10"
                      fill="#94A3B8"
                      className="font-mono font-medium"
                    >
                      {formatCompactINR(amountVal)}
                    </text>
                  </g>
                );
              })}

              {/* Area Fill */}
              {revenueAreaD && (
                <path d={revenueAreaD} fill="url(#revenueGradient)" />
              )}

              {/* Line Path */}
              {revenuePathD && (
                <path
                  d={revenuePathD}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Points */}
              {revenuePoints.map((point, idx) => {
                const cx = getX(idx, revenuePoints.length);
                const cy = getY(point.amount);
                const isHovered = hoveredRevenuePoint?.orderId === point.orderId;

                return (
                  <g key={point.orderId || idx}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : 4}
                      fill={isHovered ? '#1D4ED8' : '#FFFFFF'}
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      className="transition-all cursor-pointer"
                      onMouseEnter={() =>
                        setHoveredRevenuePoint({
                          x: cx,
                          y: cy,
                          label: point.label,
                          value: point.amount,
                          orderId: point.orderId,
                        })
                      }
                      onMouseLeave={() => setHoveredRevenuePoint(null)}
                    />
                    {/* X-axis label */}
                    <text
                      x={cx}
                      y={padTop + chartHeight + 18}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#64748B"
                      className="font-medium"
                    >
                      {point.date}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Interactive Tooltip */}
            {hoveredRevenuePoint && (
              <div
                className="absolute z-20 pointer-events-none bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs space-y-1 transform -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${(hoveredRevenuePoint.x / svgWidth) * 100}%`,
                  top: `${(hoveredRevenuePoint.y / svgHeight) * 100}%`,
                  marginTop: '-10px',
                }}
              >
                <p className="text-[10px] text-slate-400 font-mono">
                  {hoveredRevenuePoint.orderId ? `Order #${hoveredRevenuePoint.orderId.slice(-8).toUpperCase()}` : 'Order'}
                </p>
                <p className="font-bold text-sm text-emerald-400">
                  {formatINR(hoveredRevenuePoint.value)}
                </p>
                <p className="text-[10px] text-slate-300">{hoveredRevenuePoint.label}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- */}
      {/* 2 & 3. ORDERS TREND & TOP PRODUCTS (GRID)                */}
      {/* -------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. ORDERS / SALES TREND */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Order Volume Distribution</h4>
                <p className="text-[11px] text-slate-500">Confirmed store purchases by date</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
              {paidOrders.length} Paid Orders
            </span>
          </div>

          {orderBars.length === 0 ? (
            <div className="py-10 text-center text-slate-400 space-y-1 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-600">No order history available</p>
              <p className="text-[10px] text-slate-400">Orders will appear here as customers complete checkout.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-44 flex items-end justify-around gap-2 pt-4 px-2 border-b border-slate-100">
                {orderBars.map((bar) => {
                  const heightPercent = maxOrderCount > 0 ? (bar.count / maxOrderCount) * 100 : 0;
                  const isHovered = hoveredOrderBar?.label === bar.date;

                  return (
                    <div
                      key={bar.date}
                      className="flex-1 max-w-[60px] flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                      onMouseEnter={() => setHoveredOrderBar({ label: bar.date, count: bar.count, amount: bar.amount })}
                      onMouseLeave={() => setHoveredOrderBar(null)}
                    >
                      <span className="text-[10px] font-bold text-slate-700 group-hover:text-blue-600">
                        {bar.count}
                      </span>
                      <div className="w-full bg-slate-100 rounded-t-lg h-full flex items-end overflow-hidden">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-300 ${
                            isHovered ? 'bg-blue-600' : 'bg-blue-500/80 hover:bg-blue-600'
                          }`}
                          style={{ height: `${Math.max(heightPercent, 12)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 truncate w-full text-center">
                        {bar.date}
                      </span>
                    </div>
                  );
                })}
              </div>

              {hoveredOrderBar ? (
                <div className="p-2.5 bg-blue-50/80 border border-blue-100 rounded-xl text-xs flex items-center justify-between text-blue-950">
                  <span className="font-semibold">{hoveredOrderBar.label}</span>
                  <span>
                    <strong>{hoveredOrderBar.count}</strong> order{hoveredOrderBar.count === 1 ? '' : 's'} • {formatINR(hoveredOrderBar.amount)}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 text-center">
                  Hover over bars to inspect order revenue for that period
                </p>
              )}
            </div>
          )}
        </div>

        {/* 3. TOP PRODUCTS BY REVENUE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Top Products by Revenue</h4>
                <p className="text-[11px] text-slate-500">Highest grossing items from paid orders</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {topProducts.length} Product{topProducts.length === 1 ? '' : 's'}
            </span>
          </div>

          {topProducts.length === 0 ? (
            <div className="py-10 text-center text-slate-400 space-y-1 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-600">No product sales yet</p>
              <p className="text-[10px] text-slate-400">Products will rank automatically when checkouts complete.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {topProducts.map((prod, idx) => {
                const widthPercent = (prod.revenue / maxProductRevenue) * 100;
                return (
                  <div key={prod.id || idx} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800 truncate" title={prod.name}>
                          {prod.name}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 shrink-0">
                          ({prod.quantity} sold)
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 shrink-0">{formatINR(prod.revenue)}</span>
                    </div>

                    {/* Horizontal Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(widthPercent, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------- */}
      {/* 4. REVENUE ATTRIBUTION BY CHANNEL (DONUT & BREAKDOWN)   */}
      {/* -------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Channel Attribution Breakdown</h4>
              <p className="text-xs text-slate-500">
                Authoritative distribution of revenue by discovery & conversion channel
              </p>
            </div>
          </div>
          {attribution && attribution.aiInfluencedShare > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-bold self-start sm:self-auto">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{attribution.aiInfluencedShare}% AI Influenced Revenue</span>
            </div>
          )}
        </div>

        {attributionItems.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-1 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-600">No channel attribution recorded yet</p>
            <p className="text-[10px] text-slate-400">
              Orders from direct browsing, AI chat, bundles, or dynamic offers will register here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Native SVG Donut Chart */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r={donutR}
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="16"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.source}
                      cx="60"
                      cy="60"
                      r={donutR}
                      fill="none"
                      stroke={seg.config.color}
                      strokeWidth="16"
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      className="transition-all duration-300"
                    />
                  ))}
                </svg>

                {/* Center Stats */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Attributed</span>
                  <span className="text-sm font-bold text-slate-900 leading-tight">
                    {formatCompactINR(totalAttributed)}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-600 mt-0.5">
                    {attribution?.aiInfluencedShare ? `${attribution.aiInfluencedShare}% AI` : '100% Real'}
                  </span>
                </div>
              </div>
            </div>

            {/* Legend Breakdown Cards */}
            <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {donutSegments.map((seg) => (
                <div
                  key={seg.source}
                  className={`p-3 rounded-xl border border-slate-100 flex items-start justify-between gap-2 ${seg.config.bgClass}/40`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: seg.config.color }}
                      />
                      <span className="text-xs font-semibold text-slate-800">{seg.config.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 pl-4">{seg.share.toFixed(1)}% of total</p>
                  </div>
                  <span className="text-xs font-bold text-slate-900">{formatINR(seg.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
