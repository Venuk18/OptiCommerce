import React from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { 
  TrendingUp, 
  Sparkles, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Layers
} from 'lucide-react';

export function Dashboard() {
  const { products, setMerchantTab, constraints, updateConstraints, formatINR } = useCommerce();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* 4 Metric Cards (Clean Minimalism) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Revenue</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">₹2,42,503</span>
            <span className="text-emerald-600 text-xs font-bold flex items-center">
              +12.4%
            </span>
          </div>
          <p className="text-[11px] text-slate-400">vs. previous 30 days</p>
        </div>

        {/* AI-Generated Lift */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">AI-Generated Lift</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">₹18,920</span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold">
              Optimized
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Incremental margin gain</p>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Conversion Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">4.28%</span>
            <span className="text-emerald-600 text-xs font-bold">+0.8%</span>
          </div>
          <p className="text-[11px] text-slate-400">Industry avg: 2.9%</p>
        </div>

        {/* Cart Recovery */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Cart Recovery</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">31.5%</span>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[10px] font-bold">
              High Yield
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Exit-intent recovered</p>
        </div>
      </div>

      {/* Main Row: Table + AI Control settings widget */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Table: Recent AI-Optimized Catalog (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Recent AI-Optimized Catalog</h3>
              <p className="text-xs text-slate-500 mt-0.5">Live pricing & autonomous promotional triggers</p>
            </div>
            <button
              onClick={() => setMerchantTab('products')}
              className="text-blue-600 hover:text-blue-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Manage Products →
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Product Name</th>
                  <th className="px-6 py-3.5">Base Price</th>
                  <th className="px-6 py-3.5">Optimized Discount</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {products.slice(0, 5).map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={prod.image}
                          alt={prod.name}
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{prod.name}</p>
                          <p className="text-[11px] text-slate-400">{prod.category} • Margin: {prod.marginPercent}%</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {formatINR(prod.basePrice)}
                    </td>
                    <td className="px-6 py-4">
                      {prod.activeDiscountPercent > 0 ? (
                        <span className="text-blue-600 font-bold">
                          -{prod.activeDiscountPercent}% AI Triggered
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">Standard Price</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                        Live
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: AI Quick Controls & Insight Banner (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* AI Control Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">AI Control Settings</h3>
              <button
                onClick={() => setMerchantTab('ai-control')}
                className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Configure
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-700">Auto-Discounting</span>
                <button
                  onClick={() => updateConstraints({ allowPersonalizedDiscounts: !constraints.allowPersonalizedDiscounts })}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    constraints.allowPersonalizedDiscounts ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    constraints.allowPersonalizedDiscounts ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-700">Predictive Search</span>
                <button
                  onClick={() => updateConstraints({ smartUpselling: !constraints.smartUpselling })}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    constraints.smartUpselling ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    constraints.smartUpselling ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-700">Recovery Flows</span>
                <button
                  onClick={() => updateConstraints({ exitIntentIncentives: !constraints.exitIntentIncentives })}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    constraints.exitIntentIncentives ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    constraints.exitIntentIncentives ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Optimization Insight Dark Card */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden space-y-3">
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Optimization Insight</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                AI detected a 22% drop in conversion for High-Tier Headphones. Suggesting dynamic price floor adjustment to 18%.
              </p>
              <button
                onClick={() => setMerchantTab('discount-optimizer')}
                className="mt-2 text-xs font-bold bg-white text-slate-900 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"
              >
                Approve Adjustment
              </button>
            </div>
            <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-blue-600/30 rounded-full blur-xl pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
