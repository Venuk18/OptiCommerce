import React from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { 
  Zap,
  Search, 
  ShoppingBag, 
  User, 
  Command,
  LogOut
} from 'lucide-react';

export function CustomerHeader({ 
  onOpenCart, 
  onOpenLogin,
  onNavigate,
}: { 
  onOpenCart: () => void; 
  onOpenLogin?: () => void; 
  onNavigate?: (path: string) => void;
}) {
  const { 
    customerTab, 
    setCustomerTab, 
    cartCount, 
    manualSearchQuery, 
    setManualSearchQuery,
    store,
  } = useCommerce();

  const { customer, isAuthenticated, logout } = useCustomerAuth();

  const handleNav = (tab: typeof customerTab) => {
    setCustomerTab(tab);
    if (onNavigate) {
      const targetSlug = store?.slug || 'opticommerce-flagship-electronics';
      onNavigate(`/store/${targetSlug}`);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNav('shop');
  };

  const isShopActive = customerTab === 'shop' || customerTab === 'ai-assistant' || customerTab === 'storefront';

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4 sm:gap-6">
        {/* Brand Logo */}
        <button
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 shrink-0 text-left cursor-pointer group"
        >
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">OptiCommerce</span>
          </div>
        </button>

        {/* Center Search input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-lg mx-2 sm:mx-6">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={manualSearchQuery}
              onChange={(e) => {
                setManualSearchQuery(e.target.value);
              }}
              onFocus={() => {
                if (customerTab === 'home') {
                  setCustomerTab('shop');
                }
              }}
              placeholder="Search products manually..."
              className="w-full pl-11 pr-14 py-2.5 bg-slate-100/70 border border-slate-200/80 rounded-full text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <div className="absolute right-3.5 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-400 shadow-xs pointer-events-none">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </div>
        </form>

        {/* Navigation & Actions */}
        <nav className="flex items-center gap-4 sm:gap-6 text-xs font-bold tracking-wider uppercase text-slate-600">
          <button
            onClick={() => handleNav('home')}
            className={`transition-colors cursor-pointer ${
              customerTab === 'home' ? 'text-blue-600 font-extrabold' : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            HOME
          </button>

          <button
            onClick={() => handleNav('shop')}
            className={`transition-colors cursor-pointer ${
              isShopActive ? 'text-blue-600 font-extrabold' : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            SHOP
          </button>

          <button
            onClick={() => handleNav('categories')}
            className={`transition-colors cursor-pointer hidden md:inline-block ${
              customerTab === 'categories' ? 'text-blue-600 font-extrabold' : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            CATEGORIES
          </button>

          <button
            onClick={() => handleNav('orders')}
            className={`transition-colors cursor-pointer hidden md:inline-block ${
              customerTab === 'orders' ? 'text-blue-600 font-extrabold' : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            ORDERS
          </button>

          {/* Cart button with badge */}
          <button
            onClick={onOpenCart}
            className="relative p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
            aria-label="Shopping Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-blue-600 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-xs">
                {cartCount}
              </span>
            )}
          </button>

          {/* Customer Authentication State */}
          {isAuthenticated && customer ? (
            <div className="flex items-center gap-2 normal-case tracking-normal">
              <div 
                className="flex items-center gap-2 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-900 font-semibold"
                title={customer.email}
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                  {customer.name 
                    ? customer.name.slice(0, 2).toUpperCase() 
                    : (customer.email ? customer.email.slice(0, 2).toUpperCase() : 'CU')}
                </div>
                <span className="hidden sm:inline-block max-w-[110px] truncate text-[11px] font-bold">
                  {customer.name || customer.email.split('@')[0]}
                </span>
              </div>
              <button
                id="customer-header-logout-btn"
                onClick={() => logout()}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
                title="Sign out of customer account"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              id="customer-header-signin-btn"
              onClick={onOpenLogin}
              title="Customer Account / Sign In"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-xs font-bold transition-all cursor-pointer normal-case tracking-normal shadow-xs hover:shadow-sm"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In / Create Account</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

