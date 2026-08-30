import React from 'react';
import { useCommerce, MerchantTab } from '../../context/CommerceContext';
import { 
  LayoutDashboard, 
  Package, 
  Sliders, 
  Percent, 
  BarChart3, 
  Settings, 
  Store,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';

export function MerchantSidebar() {
  const { merchantTab, setMerchantTab, setExperience, setCustomerTab } = useCommerce();

  const navItems: { id: MerchantTab; label: string; icon: React.ReactNode; group?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'products', label: 'Product Catalog', icon: <Package className="w-4 h-4" /> },
    { id: 'store-management', label: 'Store Management', icon: <Store className="w-4 h-4" /> },
    { id: 'ai-control', label: 'AI Control Center', icon: <Sliders className="w-4 h-4" /> },
    { id: 'discount-optimizer', label: 'Discount Optimizer', icon: <Percent className="w-4 h-4" /> },
    { id: 'analytics', label: 'Revenue Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900 text-base tracking-tight flex items-center gap-1.5">
            OptiCommerce
          </h1>
          <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">Revenue Optimizer</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">
          Merchant Suite
        </div>

        {navItems.slice(0, 3).map((item) => {
          const isActive = merchantTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setMerchantTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors text-left ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="pt-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">
          AI Engine
        </div>

        {navItems.slice(3).map((item) => {
          const isActive = merchantTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setMerchantTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors text-left ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Customer Storefront Launch Preview Card */}
      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-900 text-white p-4 rounded-xl text-center shadow-sm">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300 font-medium mb-1">
            <span>Customer Storefront</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Live catalog synced with AI guardrails</p>
          <button
            onClick={() => {
              setExperience('customer');
              setCustomerTab('storefront');
            }}
            className="w-full py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <span>Launch Storefront</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
