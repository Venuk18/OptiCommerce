import React, { useState } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { Product } from '../../types';
import { 
  Sparkles, 
  Heart, 
  Bot, 
  TrendingUp, 
  ArrowRight, 
  Check, 
  Zap, 
  Award,
  ChevronRight,
  MoreHorizontal,
  Send,
  Loader2,
  RefreshCw,
  AlertCircle,
  PackageOpen
} from 'lucide-react';

interface CustomerHomeProps {
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
}

export function CustomerHome({ onSelectProduct, onOpenCart }: CustomerHomeProps) {
  const { 
    products, 
    isProductsLoading,
    productsError,
    refreshProducts,
    store,
    isStoreLoading,
    storeError,
    refreshStore,
    addToCart, 
    formatPrice, 
    askAIAssistant,
    setCustomerTab,
    selectedCategory,
    setSelectedCategory
  } = useCommerce();

  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [homeAIPrompt, setHomeAIPrompt] = useState('');

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
    setToastMessage(`${product.name} added to cart!`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleExamplePromptClick = (promptText: string) => {
    askAIAssistant(promptText);
  };

  const handleHomeAISubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeAIPrompt.trim()) return;
    askAIAssistant(homeAIPrompt.trim());
  };

  // Derive available categories dynamically from live products
  const productCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const displayCategories = productCategories.length > 0 ? productCategories.slice(0, 4) : ['Audio', 'Electronics', 'Home Office', 'Fitness'];

  // Specific items for home showcase safely derived from live products
  const tailoredProducts = products.slice(0, 3);
  const deskBundleProduct = products.length > 3 ? products[3] : products[0] || null;
  const fastChargeProduct = products.length > 4 ? products[4] : products[1] || null;
  const luminaLampProduct = products.length > 5 ? products[5] : products[2] || null;

  // Handle Store Error
  if (storeError && !store) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Store Not Found</h2>
        <p className="text-sm text-slate-500 max-w-md">
          {storeError || 'We could not connect to this storefront. Please verify the store slug and try again.'}
        </p>
        <button
          onClick={() => refreshStore()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  // Handle Initial Store Loading
  if (isStoreLoading && !store) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading storefront catalog...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
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

      {/* Hero Section with ambient soft glow */}
      <section className="relative pt-16 pb-14 px-4 sm:px-8 overflow-hidden">
        {/* Soft radial atmospheric backdrop glow matching screenshot */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-gradient-to-b from-blue-100/60 via-indigo-50/40 to-transparent blur-3xl -z-10 pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
            <span>{store?.name || 'OptiCommerce Store'}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight font-serif">
            Find exactly what you're looking for.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-normal">
            {store?.description || 'Our AI assistant understands your needs. Just ask or browse our smart collection.'}
          </p>

          {/* AI Shopping Assistant Interactive Box */}
          <div className="pt-4 max-w-2xl mx-auto">
            <div className="bg-white/95 backdrop-blur-md border border-indigo-100/90 rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-lg transition-all text-left space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100 shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>

                <div className="space-y-1.5 flex-1">
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                    AI Shopping Assistant
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    "Hi! I'm your AI shopping assistant. What can I help you find today? Try asking for something specific like{' '}
                    <button
                      type="button"
                      onClick={() => handleExamplePromptClick('Can you find me some wireless headphones under ₹5,000 with really strong bass?')}
                      className="inline-flex items-center px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-md font-medium transition-colors border border-blue-200/60 cursor-pointer mx-0.5"
                    >
                      wireless headphones under ₹5,000 with strong bass
                    </button>
                    {' '}or{' '}
                    <button
                      type="button"
                      onClick={() => handleExamplePromptClick('a camera for night photography under $1000')}
                      className="inline-flex items-center px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-md font-medium transition-colors border border-blue-200/60 cursor-pointer mx-0.5"
                    >
                      a camera for night photography under $1000
                    </button>
                    ."
                  </p>
                </div>
              </div>

              {/* Direct Prompt Input */}
              <form onSubmit={handleHomeAISubmit} className="relative flex items-center pt-1">
                <input
                  type="text"
                  value={homeAIPrompt}
                  onChange={(e) => setHomeAIPrompt(e.target.value)}
                  placeholder="Ask AI anything (e.g. Find headphones under ₹5,000 with punchy bass)..."
                  className="w-full pl-5 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={!homeAIPrompt.trim()}
                  className="absolute right-2 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer"
                  aria-label="Send AI Prompt"
                >
                  <Send className="w-3.5 h-3.5 fill-white" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="max-w-4xl mx-auto mt-12 flex flex-wrap items-center justify-center gap-3">
          {displayCategories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCustomerTab('shop');
                }}
                className={`px-6 py-2.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700'
                }`}
              >
                {cat}
              </button>
            );
          })}

          <button
            onClick={() => setCustomerTab('categories')}
            className="px-5 py-2.5 rounded-full text-xs font-semibold bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span>More Categories</span>
          </button>
        </div>
      </section>

      {/* Loading Products State */}
      {isProductsLoading && products.length === 0 && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Fetching catalog products...</p>
        </div>
      )}

      {/* Empty Catalog State */}
      {!isProductsLoading && products.length === 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-8 py-12 text-center">
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <PackageOpen className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Published Products in Store</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              This store currently has no active published inventory. Check back soon or switch to the Merchant Suite to publish products.
            </p>
            <button
              onClick={() => refreshProducts()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Store Catalog</span>
            </button>
          </div>
        </section>
      )}

      {/* Tailored for You Section (Matching exact 3 card row from screenshot) */}
      {tailoredProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Tailored for You</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tailoredProducts.map((product) => {
              const isFav = !!favorites[product.id];

              return (
                <div
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group cursor-pointer"
                >
                  {/* Image Container with Match Badge & Heart */}
                  <div className="relative aspect-4/3 bg-slate-50 p-6 flex items-center justify-center overflow-hidden">
                    {/* Match Score Badge (White pill with green dot) */}
                    <div className="absolute top-4 left-4 px-3 py-1 bg-white/95 backdrop-blur-xs rounded-full text-[11px] font-bold text-slate-800 flex items-center gap-1.5 shadow-xs z-10 border border-slate-100">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>{product.matchScore || 95}% MATCH</span>
                    </div>

                    {/* Favorite Heart */}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(product.id, e)}
                      className="absolute top-4 right-4 p-2 bg-white/95 backdrop-blur-xs rounded-full text-slate-400 hover:text-red-500 shadow-xs transition-colors z-10 cursor-pointer"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
                    </button>

                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                          {product.name}
                        </h3>
                        <span className="font-bold text-slate-900 text-base shrink-0">
                          {formatPrice(product.basePrice)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {product.description}
                      </p>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(product, e)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors text-center shadow-xs cursor-pointer"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Trending Insights Section (Matching exact screenshot bottom layout) */}
      {deskBundleProduct && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Trending Insights</h2>
            </div>

            <button
              onClick={() => setCustomerTab('shop')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 uppercase tracking-wider cursor-pointer"
            >
              <span>VIEW ALL</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Left Hero Card */}
            <div 
              onClick={() => onSelectProduct(deskBundleProduct)}
              className="lg:col-span-2 relative rounded-3xl overflow-hidden bg-slate-900 shadow-sm hover:shadow-md transition-all group cursor-pointer min-h-[320px] sm:min-h-[360px] flex flex-col justify-between"
            >
              {/* Background image */}
              <img
                src={deskBundleProduct.image}
                alt={deskBundleProduct.name}
                className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
              />

              {/* Gradient Overlay for high text contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

              {/* Top Left Badge */}
              <div className="relative z-10 p-6">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/95 backdrop-blur-xs rounded-full text-xs font-bold text-slate-900 shadow-sm">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  <span>Top Conversion Rate</span>
                </div>
              </div>

              {/* Bottom Content */}
              <div className="relative z-10 p-6 sm:p-8 space-y-3">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  {deskBundleProduct.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 max-w-lg leading-relaxed line-clamp-2">
                  {deskBundleProduct.description}
                </p>
                <div className="pt-2 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(deskBundleProduct, 1);
                      onOpenCart();
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    Shop Bundle
                  </button>
                  <span className="text-white font-bold text-base">
                    {formatPrice(deskBundleProduct.basePrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Mini Feature Cards if available */}
            <div className="grid grid-cols-1 gap-6">
              {fastChargeProduct && (
                <div
                  onClick={() => onSelectProduct(fastChargeProduct)}
                  className="bg-slate-50/80 hover:bg-slate-100/90 rounded-3xl p-6 border border-slate-200/70 transition-all flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Zap className="w-5 h-5 fill-white" />
                    </div>
                    <span className="text-base font-extrabold text-slate-900">
                      {formatPrice(fastChargeProduct.basePrice)}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1">
                    <h4 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                      {fastChargeProduct.name}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {fastChargeProduct.description ? fastChargeProduct.description.split('.')[0] + '.' : ''}
                    </p>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(fastChargeProduct, e)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Quick Add</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {luminaLampProduct && (
                <div
                  onClick={() => onSelectProduct(luminaLampProduct)}
                  className="bg-slate-50/80 hover:bg-slate-100/90 rounded-3xl p-6 border border-slate-200/70 transition-all flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Award className="w-5 h-5" />
                    </div>
                    <span className="text-base font-extrabold text-slate-900">
                      {formatPrice(luminaLampProduct.basePrice)}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1">
                    <h4 className="font-bold text-slate-900 text-base group-hover:text-purple-600 transition-colors">
                      {luminaLampProduct.name}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {luminaLampProduct.description ? luminaLampProduct.description.split('.')[0] + '.' : ''}
                    </p>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(luminaLampProduct, e)}
                      className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Quick Add</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
