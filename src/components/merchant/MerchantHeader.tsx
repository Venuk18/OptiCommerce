import React from 'react';
import { Search, Bell, Sparkles, LogOut, Store as StoreIcon, ShieldCheck } from 'lucide-react';
import { useCommerce } from '../../context/CommerceContext';
import { useAuth } from '../../context/AuthContext';

export function MerchantHeader() {
  const { constraints } = useCommerce();
  const { merchant, isAuthenticated, logout } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return 'MA';
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
      {/* Search bar matching Stitch */}
      <div className="flex-1 max-w-lg">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products, insights, or reports..."
            className="w-full pl-10 pr-4 py-2 bg-slate-100/70 border border-slate-200 rounded-full text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-5">
        {/* Live AI Status pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span>AI Engine Active</span>
          {constraints.allowPersonalizedDiscounts && (
            <span className="text-[10px] bg-green-200/60 text-green-800 px-1.5 py-0.5 rounded-full font-bold">
              Dynamic
            </span>
          )}
        </div>

        {/* Store badge if authenticated */}
        {isAuthenticated && merchant?.store && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs font-medium text-slate-700">
            <StoreIcon className="w-3.5 h-3.5 text-slate-500" />
            <span className="truncate max-w-[150px]">{merchant.store.name}</span>
          </div>
        )}

        {/* Notifications */}
        <button className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-colors">
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 bg-red-500 rounded-full absolute top-1.5 right-1.5"></span>
        </button>

        {/* Admin profile & Logout */}
        {isAuthenticated && merchant ? (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">{merchant.name}</p>
              <p className="text-[10px] font-medium text-slate-500 truncate max-w-[140px]">{merchant.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center border-2 border-slate-100 shadow-sm">
              {getInitials(merchant.name)}
            </div>
            <button
              onClick={logout}
              title="Logout from Merchant Suite"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">Unauthenticated</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Guest View</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-600 font-bold text-xs flex items-center justify-center border-2 border-slate-100 shadow-sm">
              ?
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
