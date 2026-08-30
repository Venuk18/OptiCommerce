import React, { useState, useMemo } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { Product } from '../../types';
import { 
  Search, 
  Sparkles, 
  Star, 
  ShoppingCart, 
  SlidersHorizontal, 
  X, 
  Check,
  Bot,
  ArrowUpDown,
  Filter
} from 'lucide-react';

interface ManualShopViewProps {
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
}

export function ManualShopView({ onSelectProduct, onOpenCart }: ManualShopViewProps) {
  const { 
    products, 
    addToCart, 
    formatPrice, 
    manualSearchQuery, 
    setManualSearchQuery,
    selectedCategory,
    setSelectedCategory,
    setCustomerTab,
    askAIAssistant
  } = useCommerce();

  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'rating'>('featured');
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const categories = ['All', 'Audio', 'Electronics', 'Home Office', 'Fitness'];

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Category filter
      if (selectedCategory !== 'All' && product.category !== selectedCategory) {
        return false;
      }

      // Manual search keyword filter
      if (manualSearchQuery.trim()) {
        const query = manualSearchQuery.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesDesc = product.description.toLowerCase().includes(query);
        const matchesTags = product.tags.some(tag => tag.toLowerCase().includes(query));
        const matchesCategory = product.category.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesTags && !matchesCategory) {
          return false;
        }
      }

      // Price filter
      if (product.basePrice > maxPrice) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price-low') return a.basePrice - b.basePrice;
      if (sortBy === 'price-high') return b.basePrice - a.basePrice;
      if (sortBy === 'rating') return b.rating - a.rating;
      return (b.matchScore || 0) - (a.matchScore || 0);
    });
  }, [products, selectedCategory, manualSearchQuery, maxPrice, sortBy]);

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
    setToastMessage(`${product.name} added to cart!`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSwitchToAI = () => {
    if (manualSearchQuery.trim()) {
      askAIAssistant(manualSearchQuery.trim());
    } else {
      setCustomerTab('ai-assistant');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-bounce border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
          <button onClick={onOpenCart} className="ml-2 text-blue-400 hover:text-white underline cursor-pointer">
            View Cart
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header & AI Switch Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Manual Catalog Shop</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {manualSearchQuery ? `Search Results for "${manualSearchQuery}"` : 'Explore All Products'}
            </h1>
            <p className="text-sm text-slate-500">
              Showing {filteredProducts.length} items available in store
            </p>
          </div>

          {/* AI Concierge Shortcut Card */}
          <button
            onClick={handleSwitchToAI}
            className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-2xl transition-all text-left shadow-xs cursor-pointer group shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                <span>AI Shopping Assistant</span>
              </div>
              <div className="text-xs text-slate-700 font-medium">
                Want AI recommendations? Ask Concierge →
              </div>
            </div>
          </button>
        </div>

        {/* Filters and Controls Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Search input in shop view & sort */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                placeholder="Filter catalog products..."
                className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {manualSearchQuery && (
                <button
                  onClick={() => setManualSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <div className="relative flex items-center gap-2 shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="py-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="featured">Featured / Best Match</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No products found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              We couldn't find any products matching "{manualSearchQuery}". Try adjusting your filters or ask our AI Shopping Assistant.
            </p>
            <button
              onClick={() => {
                setManualSearchQuery('');
                setSelectedCategory('All');
              }}
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group cursor-pointer"
              >
                {/* Product Image Area */}
                <div className="relative aspect-square bg-slate-50 p-6 flex items-center justify-center overflow-hidden">
                  {product.matchScore && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs z-10 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 fill-white" />
                      <span>{product.matchScore}% Match</span>
                    </div>
                  )}

                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Product Info */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {product.category}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
                      {product.name}
                    </h3>
                    
                    <div className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-slate-800 font-bold">{product.rating}</span>
                      <span className="text-slate-400 font-normal">({product.ratingCount})</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="text-blue-600 font-extrabold text-base">
                      {formatPrice(product.basePrice)}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(product, e)}
                      className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center"
                      aria-label="Add to cart"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
