import React from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Brain, 
  Layers, 
  Percent, 
  BarChart3, 
  GitCompare, 
  Bot, 
  Target, 
  TrendingUp, 
  ShieldCheck, 
  Repeat, 
  ShoppingBag, 
  CheckCircle2,
  ChevronRight,
  Store
} from 'lucide-react';

interface MerchantLandingProps {
  onNavigate: (to: string) => void;
}

export function MerchantLanding({ onNavigate }: MerchantLandingProps) {
  const handleContinue = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    onNavigate('/merchant/login');
  };

  const capabilities = [
    {
      icon: <Brain className="w-6 h-6 text-blue-600" />,
      title: 'AI Product Recommendations',
      description: 'Dynamic neural scoring ranks high-intent catalog products in real time based on active customer conversation context.',
      badge: 'Intent-Driven',
    },
    {
      icon: <Bot className="w-6 h-6 text-indigo-600" />,
      title: 'Conversational Shopping',
      description: 'An AI sales assistant guides customers through natural dialogue, clarifying complex specifications and closing sales.',
      badge: '24/7 Agent',
    },
    {
      icon: <GitCompare className="w-6 h-6 text-purple-600" />,
      title: 'Intelligent Comparison',
      description: 'Side-by-side product comparisons with automated trade-off reasoning that helps indecisive shoppers commit faster.',
      badge: 'Decision Acceleration',
    },
    {
      icon: <Layers className="w-6 h-6 text-emerald-600" />,
      title: 'Cross-Sell & Bundling',
      description: 'Category-compatible accessory recommendations that seamlessly lift average order value at the point of intent.',
      badge: 'AOV Growth',
    },
    {
      icon: <Percent className="w-6 h-6 text-amber-600" />,
      title: 'Smart Commercial Offers',
      description: 'Autonomous discounting that maximizes conversion while strictly enforcing merchant floor margin guardrails.',
      badge: 'Margin Protected',
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-blue-600" />,
      title: 'Revenue Intelligence',
      description: 'Real-time telemetry showing conversion funnel health, demand trends, and exact revenue unlocked by AI recommendations.',
      badge: 'Real-Time Insights',
    },
  ];

  const revenueJourneySteps = [
    {
      step: '01',
      title: 'Understand High-Intent Customers',
      description: 'Analyze real-time inquiries to understand what customers actually want.',
      icon: <Target className="w-5 h-5 text-blue-600" />,
      pill: 'Customer Intent',
    },
    {
      step: '02',
      title: 'Recommend the Right Products',
      description: 'AI-powered recommendations reduce choice overload and irrelevant browsing.',
      icon: <Brain className="w-5 h-5 text-indigo-600" />,
      pill: 'Better Recommendations',
    },
    {
      step: '03',
      title: 'Increase Conversions',
      description: 'Automated sales reasoning helps customers make confident purchase decisions.',
      icon: <TrendingUp className="w-5 h-5 text-purple-600" />,
      pill: 'Better Decisions',
    },
    {
      step: '04',
      title: 'Increase Average Order Value',
      description: 'Intelligent cross-sell and bundle recommendations encourage relevant add-ons.',
      icon: <ShoppingBag className="w-5 h-5 text-emerald-600" />,
      pill: 'Higher Order Value',
    },
    {
      step: '05',
      title: 'Drive Repeat Purchases',
      description: 'Context-aware and personalized shopping experiences foster stronger relationships.',
      icon: <Repeat className="w-5 h-5 text-amber-600" />,
      pill: 'More Revenue',
    },
  ];

  const intentFlowStages = [
    { title: 'Customer Intent', sub: 'Natural query or search', icon: <Target className="w-4 h-4 text-blue-600" /> },
    { title: 'AI Understanding', sub: 'Multi-turn context parsing', icon: <Brain className="w-4 h-4 text-indigo-600" /> },
    { title: 'Personalized Recommendations', sub: 'Catalog match scoring', icon: <Sparkles className="w-4 h-4 text-purple-600" /> },
    { title: 'Purchase Guidance', sub: 'AI sales reasoning', icon: <Bot className="w-4 h-4 text-blue-600" /> },
    { title: 'Conversion', sub: 'Confident add-to-cart', icon: <TrendingUp className="w-4 h-4 text-emerald-600" /> },
    { title: 'Cross-Sell / Bundle', sub: 'Complementary products', icon: <Layers className="w-4 h-4 text-amber-600" /> },
    { title: 'Merchant Revenue', sub: 'High-margin transaction', icon: <BarChart3 className="w-4 h-4 text-emerald-600" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 animate-fadeIn">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-lg tracking-tight flex items-center gap-1.5">
                OptiCommerce
              </span>
              <span className="text-[11px] text-blue-600 font-bold uppercase tracking-wider block -mt-0.5">
                Revenue Optimizer
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>AI Engine Ready</span>
            </div>

            <button
              onClick={handleContinue}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <span>Continue as Merchant</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/50 to-[#F8FAFC]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-xs font-extrabold mb-8 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>AI-Native Commerce &amp; Revenue Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-950 tracking-tight leading-[1.15] max-w-4xl mx-auto mb-6">
            Turn every customer interaction into a{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700">
              smarter path to purchase.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
            OptiCommerce helps merchants understand customer intent, guide purchase decisions, increase conversions, grow order value, and turn AI-powered shopping interactions into measurable revenue.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={handleContinue}
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Continue as Merchant</span>
              <ArrowRight className="w-4 h-4 text-blue-400" />
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-4 font-medium">
            Already have a merchant account? Continue to your dashboard.
          </p>
        </div>
      </section>

      {/* 2. WHAT IS OPTICOMMERCE? */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <span className="text-xs font-extrabold text-blue-600 tracking-wider uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
            Platform Overview
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3 mb-4">
            What is OptiCommerce?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            OptiCommerce is an AI-native commerce engine designed to help merchants convert customer intent into revenue. By embedding real-time reasoning and sales intelligence directly into the customer discovery loop, merchants transform casual browsers into high-confidence buyers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {[
            { title: 'Understand Customer Intent', desc: 'Decode complex preferences and natural customer requirements instantly.' },
            { title: 'Personalize Product Discovery', desc: 'Serve dynamically ranked recommendations curated for active context.' },
            { title: 'Guide Purchase Decisions', desc: 'Provide transparent AI reasoning, feature breakdowns, and comparisons.' },
            { title: 'Increase Conversion', desc: 'Reduce indecision and abandonment with proactive, relevant guidance.' },
            { title: 'Cross-Sell & Bundle Intelligently', desc: 'Suggest relevant accessories and packages to increase transaction size.' },
            { title: 'Provide Controlled Commercial Offers', desc: 'Deliver margin-safe promotional incentives tailored to customer hesitation.' },
            { title: 'Give Merchants Revenue Intelligence', desc: 'Gain complete visibility into demand, funnel transitions, and catalog velocity.' },
          ].map((item, idx) => (
            <div 
              key={idx} 
              className={`p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-blue-300 transition-colors ${
                idx === 6 ? 'md:col-span-2 lg:col-span-3 bg-gradient-to-r from-blue-50/50 to-indigo-50/30' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. HOW OPTICOMMERCE INCREASES REVENUE (Connected 5-step journey) */}
      <section className="py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-xs font-extrabold text-blue-600 tracking-wider uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
              The Growth Flywheel
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3 mb-4">
              How OptiCommerce Increases Revenue
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Every stage of the customer interaction is designed to strengthen conviction and grow transaction value.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative max-w-6xl mx-auto">
            {revenueJourneySteps.map((step, idx) => (
              <div 
                key={idx}
                className="relative bg-[#F8FAFC] border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:shadow-md transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-black text-slate-400 group-hover:text-blue-600 transition-colors">
                      {step.step}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 leading-snug mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    {step.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                    {step.pill}
                  </span>
                  {idx < 4 && (
                    <ChevronRight className="hidden md:block w-4 h-4 text-slate-300 absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Connected Flow Banner */}
          <div className="mt-10 max-w-4xl mx-auto p-4 bg-slate-900 text-white rounded-2xl shadow-sm text-center">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
              <span className="text-slate-300">Customer Intent</span>
              <span className="text-blue-400">→</span>
              <span className="text-slate-300">Better Recommendations</span>
              <span className="text-blue-400">→</span>
              <span className="text-slate-300">Better Decisions</span>
              <span className="text-blue-400">→</span>
              <span className="text-slate-300">More Purchases</span>
              <span className="text-blue-400">→</span>
              <span className="text-slate-300">Higher Order Value</span>
              <span className="text-blue-400">→</span>
              <span className="text-emerald-400 font-bold">More Revenue</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. INTENT → REVENUE FLOW (Visually distinct second explanation) */}
      <section className="py-20 bg-slate-950 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-xs font-extrabold text-blue-400 tracking-wider uppercase bg-blue-900/50 px-3 py-1 rounded-full border border-blue-700/50">
              Pipeline Architecture
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-3 mb-4">
              Intent → Revenue Flow
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Trace how customer inquiries are synthesized into actionable merchant transactions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 max-w-6xl mx-auto">
            {intentFlowStages.map((stage, idx) => (
              <div 
                key={idx}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-blue-500/60 transition-colors text-center sm:text-left"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center mb-3 mx-auto sm:mx-0">
                    {stage.icon}
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 block mb-1">
                    Stage 0{idx + 1}
                  </span>
                  <h4 className="text-xs font-bold text-slate-100 mb-1 leading-snug">
                    {stage.title}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {stage.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. PLATFORM CAPABILITIES (Six polished cards) */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="text-xs font-extrabold text-blue-600 tracking-wider uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
            Engine Features
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3 mb-4">
            Platform Capabilities
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Enterprise-grade capabilities engineered specifically for revenue optimization.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {capabilities.map((cap, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-2xl p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {cap.icon}
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                    {cap.badge}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mb-2">
                  {cap.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {cap.description}
                </p>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-100 flex items-center text-xs font-bold text-blue-600 group-hover:text-blue-700">
                <span>Verified in OptiCommerce Core</span>
                <CheckCircle2 className="w-3.5 h-3.5 ml-1.5 text-emerald-500" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. MERCHANT VALUE ("From Customer Intent to Merchant Revenue") */}
      <section className="py-20 bg-gradient-to-b from-white to-slate-50 border-t border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center">
          <span className="text-xs font-extrabold text-blue-600 tracking-wider uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
            Merchant Value
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3 mb-4">
            From Customer Intent to Merchant Revenue
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto mb-12">
            OptiCommerce connects customer-facing AI interactions with merchant-side revenue intelligence, turning subjective discovery into repeatable, measurable commercial success.
          </p>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Discovery</span>
                <p className="text-xs font-bold text-slate-900 mt-1">More Relevant Discovery</p>
              </div>
              <div className="text-slate-300 font-bold text-lg hidden sm:block">→</div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Conviction</span>
                <p className="text-xs font-bold text-slate-900 mt-1">Better Purchase Decisions</p>
              </div>
              <div className="text-slate-300 font-bold text-lg hidden sm:block">→</div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Volume</span>
                <p className="text-xs font-bold text-slate-900 mt-1">More Conversions</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 items-center max-w-2xl mx-auto">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200/70">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Expansion</span>
                <p className="text-xs font-bold text-blue-950 mt-1">Larger Average Orders</p>
              </div>
              <div className="text-blue-300 font-bold text-lg hidden sm:block text-center">→</div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/70">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Outcome</span>
                <p className="text-xs font-bold text-emerald-950 mt-1">Accelerated Revenue</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FINAL CTA */}
      <section className="py-20 bg-slate-900 text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 relative z-10">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-400 border border-white/10 shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4 text-white">
            Ready to turn AI into revenue?
          </h2>

          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
            Access your merchant dashboard to configure catalogs, inspect AI recommendation telemetry, set margin guardrails, and track orders.
          </p>

          <button
            onClick={handleContinue}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-sm font-bold inline-flex items-center gap-2.5 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
          >
            <span>Continue as Merchant</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-xs text-slate-500 mt-5">
            Already have a merchant account? Continue to your dashboard.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 py-8 border-t border-slate-800/80 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="font-bold text-slate-300">OptiCommerce</span>
            <span className="text-slate-600">|</span>
            <span>AI-Native Commerce &amp; Revenue Engine</span>
          </div>

          <p className="text-slate-500">
            &copy; {new Date().getFullYear()} OptiCommerce. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
