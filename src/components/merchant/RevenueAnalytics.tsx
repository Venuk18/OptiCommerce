import React from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  ShoppingBag, 
  ArrowUpRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

export function RevenueAnalytics() {
  const { formatINR } = useCommerce();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Revenue Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time performance attribution, AI conversion lift, and margin preservation statistics.
        </p>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gross Merchandise Value</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">₹2,42,503</p>
          <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>+14.2% optimized lift</span>
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Profit Protection</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">38.4%</p>
          <p className="text-xs text-slate-500">Average preserved profit margin</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Autonomous Decisions</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600">1,480</p>
          <p className="text-xs text-slate-500">Real-time discount & intent nudges</p>
        </div>
      </div>

      {/* Attribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Revenue Lift by AI Trigger Type</h3>
          
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Personalized Search Match Nudges</span>
                <span className="text-blue-600 font-bold">46% (₹8,703)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '46%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Exit-Intent Cart Recovery</span>
                <span className="text-purple-600 font-bold">32% (₹6,054)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '32%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Cross-Sell Bundle Recommendations</span>
                <span className="text-emerald-600 font-bold">22% (₹4,163)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '22%' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Margin Guardrail Health</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Every customer transaction is audited against your merchant constraints (20% Floor, 15% Max discount).
          </p>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>0% Margin Violations Detected</span>
            </div>
            <p className="text-[11px] text-emerald-700 leading-normal">
              AI optimizer successfully rejected 184 excessive coupon attempts and preserved ₹12,400 in merchant margins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
