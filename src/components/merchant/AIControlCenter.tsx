import React, { useState } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { 
  Percent, 
  TrendingUp, 
  Sparkles, 
  ShieldCheck, 
  Save, 
  RotateCcw,
  CheckCircle2
} from 'lucide-react';

export function AIControlCenter() {
  const { 
    constraints, 
    updateConstraints, 
    saveConstraints, 
    discardConstraints, 
    isConstraintsDirty 
  } = useCommerce();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSave = () => {
    saveConstraints();
    setToastMessage('AI Operational Constraints successfully updated & synced with Storefront!');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDiscard = () => {
    discardConstraints();
    setToastMessage('Pending modifications discarded.');
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 text-sm animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Control Center</h1>
        <p className="text-sm text-slate-500 mt-1.5 max-w-3xl leading-relaxed">
          Define the operational boundaries for the AI Revenue Optimizer. The AI will autonomously adjust pricing,
          product recommendations, and recovery strategies while strictly adhering to these constraints to maximize
          your revenue safely.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Discount Optimization Rules (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div>
            {/* Title Section with Blue % Badge */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Discount Optimization Rules</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set the financial boundaries for automated pricing adjustments.
                </p>
              </div>
            </div>

            {/* Constraints Sliders & Inputs */}
            <div className="mt-8 space-y-7">
              {/* Maximum Discount Limit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800">Maximum Discount Limit</label>
                    <p className="text-xs text-slate-400">The absolute highest discount the AI can offer a user.</p>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">
                    <span className="text-sm font-bold text-slate-900">{constraints.maxDiscountLimit}</span>
                    <span className="text-xs text-slate-500 font-semibold">%</span>
                  </div>
                </div>

                <div className="pt-2">
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    value={constraints.maxDiscountLimit}
                    onChange={(e) => updateConstraints({ maxDiscountLimit: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>0%</span>
                    <span>15% (Recommended)</span>
                    <span>40%</span>
                  </div>
                </div>
              </div>

              {/* Minimum Profit Margin Floor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800">Minimum Profit Margin Floor</label>
                    <p className="text-xs text-slate-400">AI will not apply discounts that drop the margin below this threshold.</p>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">
                    <span className="text-sm font-bold text-slate-900">{constraints.minProfitMarginFloor}</span>
                    <span className="text-xs text-slate-500 font-semibold">%</span>
                  </div>
                </div>

                <div className="pt-2">
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={constraints.minProfitMarginFloor}
                    onChange={(e) => updateConstraints({ minProfitMarginFloor: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>5% (High Risk)</span>
                    <span>20% (Safe Baseline)</span>
                    <span>50%</span>
                  </div>
                </div>
              </div>

              {/* Allow AI-driven personalized discounts toggle card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Allow AI-driven personalized discounts</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enables machine learning models to tailor discounts to individual user behavior.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConstraints({ allowPersonalizedDiscounts: !constraints.allowPersonalizedDiscounts })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                    constraints.allowPersonalizedDiscounts ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Growth & Recovery toggles (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Revenue Growth Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Revenue Growth</h2>
            </div>

            <div className="space-y-4">
              {/* Smart Upselling */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="pr-4">
                  <p className="text-xs font-bold text-slate-800">Smart Upselling</p>
                  <p className="text-xs text-slate-500 mt-0.5">Recommend higher-tier products during discovery.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConstraints({ smartUpselling: !constraints.smartUpselling })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    constraints.smartUpselling ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                </button>
              </div>

              {/* Cross-selling Intelligence */}
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <p className="text-xs font-bold text-slate-800">Cross-selling Intelligence</p>
                  <p className="text-xs text-slate-500 mt-0.5">Automated bundles and accessories.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConstraints({ crossSellingIntelligence: !constraints.crossSellingIntelligence })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    constraints.crossSellingIntelligence ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                </button>
              </div>
            </div>
          </div>

          {/* Customer Recovery Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900">Customer Recovery</h2>
            </div>

            <div className="space-y-4">
              {/* AI Product Alternatives */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="pr-4">
                  <p className="text-xs font-bold text-slate-800">AI Product Alternatives</p>
                  <p className="text-xs text-slate-500 mt-0.5">Suggest better-fit products if customer is hesitant.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConstraints({ aiProductAlternatives: !constraints.aiProductAlternatives })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    constraints.aiProductAlternatives ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                </button>
              </div>

              {/* Exit-intent Incentives */}
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <p className="text-xs font-bold text-slate-800">Exit-intent Incentives</p>
                  <p className="text-xs text-slate-500 mt-0.5">Small effective nudges to prevent cart abandonment.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConstraints({ exitIntentIncentives: !constraints.exitIntentIncentives })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    constraints.exitIntentIncentives ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Save / Discard Action Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium text-slate-600">
            AI will always respect these boundaries while optimizing for maximum revenue.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isConstraintsDirty}
            className={`flex-1 sm:flex-none px-5 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-1.5 ${
              isConstraintsDirty 
                ? 'bg-white hover:bg-slate-100 text-slate-700 cursor-pointer' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Discard Changes</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 sm:flex-none px-6 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Constraints</span>
          </button>
        </div>
      </div>
    </div>
  );
}
