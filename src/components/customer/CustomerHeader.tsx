import React from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { 
  Zap,
  Search, 
  ShoppingBag, 
  User, 
  Command,
  Sparkles
} from 'lucide-react';

export function CustomerHeader({ 
  onOpenCart, 
  onOpenLogin 
}: { 
  onOpenCart: () => void; 
  onOpenLogin?: () => void; 
}) {
  const { 
    customerTab, 
    setCustomerTab, 
    cartCount, 
    manualSearchQuery, 
    setManualSearchQuery,
  } = useCommerce();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerTab('shop');
  };

  const isShopActive = customerTab === 'shop' || customerTab === 'ai-assistant' || customerTab === 'storefront';

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4 sm:gap-6">
        {/* Brand Logo */}
        <button
          onClick={() => setCustomerTab('home')}
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
        <nav className="flex items-center gap-5 sm:gap-7 text-xs font-bold tracking-wider uppercase text-slate-600">
          <button
            onClick={() => setCustomerTab('home')}
            className={`transition-colors cursor-pointer ${
              customerTab === 'home' ? 'text-blue-600 font-extrabold' : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            HOME
          </button>

          <button
            onClick={() => setCustomerTab('shop')}
            className={`transition-colors cursor-pointer ${
              isShopActive ? 'text-blue-600 font-extrabold' : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            SHOP
          </button>

          <button
            onClick={() => setCustomerTab('categories')}
            className={`transition-colors cursor-pointer hidden md:inline-block ${
              customerTab === 'categories' ? 'text-blue-600 font-extrabold' : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            CATEGORIES
          </button>

          <button
            onClick={() => setCustomerTab('orders')}
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

          {/* Customer Avatar / Sign In */}
          <div 
            onClick={onOpenLogin}
            title="Customer Account / Sign In"
            className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-xs cursor-pointer hover:bg-blue-700 transition-colors"
          >
            <User className="w-4 h-4" />
          </div>
        </nav>
      </div>
    </header>
  );
}

