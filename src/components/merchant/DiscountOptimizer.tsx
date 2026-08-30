import React, { useState } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { 
  Sliders, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  User, 
  ChevronRight, 
  Info,
  DollarSign
} from 'lucide-react';

export function DiscountOptimizer() {
  const { 
    constraints, 
    setMerchantTab, 
    simulationContext, 
    scenarios, 
    runNewSimulation, 
    products, 
    formatINR 
  } = useCommerce();

  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>('sc-2');

  const activeProduct = products.find(p => p.id === simulationContext.activeCartItemId) || products[3];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Discount Optimizer</h1>
        <p className="text-sm text-slate-500 mt-1.5 max-w-3xl leading-relaxed">
          Simulate and fine-tune how AI allocates discounts based on customer intent, maximizing
          revenue while strictly adhering to your margin requirements.
        </p>
      </div>

      {/* Top Merchant Constraints Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Sliders className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Merchant Constraints</h2>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>AI Allocation Active</span>
          </div>
        </div>

        {/* 3 Constraints Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Max Allowed Discount */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Max Allowed Discount
              </span>
              <Info className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-blue-600">
              {constraints.maxDiscountLimit}%
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{ width: `${(constraints.maxDiscountLimit / 40) * 100}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-medium pt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Minimum Floor Margin */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Minimum Floor Margin
              </span>
              <Info className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {constraints.minProfitMarginFloor}%
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full"
                style={{ width: `${(constraints.minProfitMarginFloor / 50) * 100}%` }}
              ></div>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              AI will not recommend discounts below this threshold.
            </p>
          </div>

          {/* Primary Objective */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Primary Objective
              </span>
              <div className="flex items-start gap-3 pt-1">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Net Revenue</p>
                  <p className="text-xs text-slate-500">Balancing Conversion & Margin</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setMerchantTab('ai-control')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-4 transition-colors cursor-pointer"
            >
              <span>Edit Parameters</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* AI Decision Simulator Section */}
      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">AI Decision Simulator</h2>
          </div>

          <button
            onClick={runNewSimulation}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>New Scenario</span>
          </button>
        </div>

        {/* Simulator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Live Inference Context (5 cols) */}
          <div className="lg:col-span-5 bg-blue-50/50 border border-blue-100 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Live Inference Context
              </div>

              {/* Target Profile */}
              <div className="flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{simulationContext.targetProfileName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{simulationContext.targetProfileType}</p>
                </div>
              </div>

              {/* Active Cart Item */}
              <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                <img
                  src={activeProduct.image}
                  alt={activeProduct.name}
                  className="w-12 h-12 object-cover rounded-lg border border-slate-100 shrink-0"
                />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{activeProduct.name}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Base Price: <span className="font-bold text-slate-900">{formatINR(activeProduct.basePrice)}</span>
                  </p>
                </div>
              </div>

              {/* Calculated Purchase Intent */}
              <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Calculated Purchase Intent</span>
                  <span className="font-bold text-emerald-600">{simulationContext.calculatedPurchaseIntent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${simulationContext.calculatedPurchaseIntent}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-slate-500 italic mt-1 leading-relaxed">
                  {simulationContext.intentSummary}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Simulated Outcomes (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Simulated Outcomes
            </div>

            <div className="space-y-3">
              {scenarios.map((sc) => {
                const isSelected = selectedOutcomeId === sc.id;
                return (
                  <div
                    key={sc.id}
                    onClick={() => setSelectedOutcomeId(sc.id)}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50/40 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{sc.label}</span>
                          <span className="text-xs text-blue-600 font-semibold">{sc.description}</span>
                        </div>
                        {sc.marginErosionWarning && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-700 font-semibold mt-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Margin erosion detected</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-8 text-right">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Est. Conversion</p>
                        <div className="flex items-center justify-end gap-1 text-xs font-bold text-slate-900 mt-0.5">
                          <span>{sc.estConversionRate}%</span>
                          {sc.conversionLift && (
                            <span className="text-emerald-600 font-semibold text-[11px]">{sc.conversionLift}</span>
                          )}
                        </div>
                      </div>

                      <div className="min-w-[90px]">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Expected Revenue</p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">
                          {formatINR(sc.expectedRevenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AI Recommendation Rationale Callout (Matching Screen 2/3 bottom) */}
            <div className="mt-4 p-5 rounded-2xl bg-purple-50/60 border border-purple-200 relative overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                    AI Recommendation Rationale
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    A <strong className="text-purple-900 font-bold">5% incentive</strong> provides the best conversion-to-margin tradeoff.
                    While 10% off increases the probability of conversion slightly (from 68% to 71%), the absolute
                    gross margin lost outweighs the expected revenue gain, violating the optimization directive to maximize
                    net merchant value.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
