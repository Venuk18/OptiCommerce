import React, { useState } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { Product } from '../../types';
import { 
  Sparkles, 
  Heart, 
  Star, 
  Lightbulb, 
  Check, 
  Bot, 
  SlidersHorizontal,
  DollarSign,
  Palette,
  Layers,
  ArrowRight
} from 'lucide-react';

interface StorefrontAISearchProps {
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
}

export function StorefrontAISearch({ onSelectProduct, onOpenCart }: StorefrontAISearchProps) {
  const { 
    filteredRecommendations, 
    searchQuery, 
    searchFilterAdjustment, 
    setSearchFilterAdjustment, 
    addToCart, 
    formatINR,
    constraints 
  } = useCommerce();

  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [addedItemNotice, setAddedItemNotice] = useState<string | null>(null);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddToCart = (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(prod, 1);
    setAddedItemNotice(`${prod.name} added to cart!`);
    setTimeout(() => setAddedItemNotice(null), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-12 animate-fadeIn">
      {/* Toast */}
      {addedItemNotice && (
        <div className="fixed top-24 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-bounce border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{addedItemNotice}</span>
          <button onClick={onOpenCart} className="ml-2 text-blue-400 hover:text-white underline cursor-pointer">
            View Cart
          </button>
        </div>
      )}

      {/* Top AI Result Header (Matching Screen 4) */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100">
          <Sparkles className="w-3.5 h-3.5" />
          <span>OptiCommerce AI Results</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Here are your personalized recommendations
        </h1>

        <p className="text-sm text-slate-600 font-medium">
          Based on your preference for <span className="text-slate-900 font-semibold">"{searchQuery}"</span>.
        </p>

        <p className="text-xs text-blue-600 font-semibold">
          Showing products currently available in OptiCommerce store.
        </p>
      </div>

      {/* Product Cards Grid (3 cards row matching Screen 4) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {filteredRecommendations.slice(0, 3).map((product, index) => {
          const isFav = !!favorites[product.id];
          const badgeColor = index === 0 
            ? 'bg-purple-600 text-white' 
            : 'bg-blue-100 text-blue-700 font-bold';

          return (
            <div
              key={product.id}
              onClick={() => onSelectProduct(product)}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group cursor-pointer"
            >
              {/* Image Container with Badges */}
              <div className="relative aspect-4/3 bg-slate-50 p-6 flex items-center justify-center overflow-hidden">
                {/* Match Score Badge */}
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-xs z-10 ${badgeColor}`}>
                  <Sparkles className="w-3 h-3" />
                  <span>{product.matchScore || 90}% Match</span>
                </div>

                {/* Favorite Heart */}
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(product.id, e)}
                  className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-xs rounded-full text-slate-400 hover:text-red-500 shadow-xs transition-colors z-10 cursor-pointer"
                >
                  <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
                </button>

                {/* Product Image */}
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
                      {formatINR(product.basePrice)}
                    </span>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < Math.floor(product.rating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-slate-500 font-medium">({product.rating})</span>
                  </div>

                  {/* Why it matches Light-Blue Box (Exact Stitch Feature) */}
                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-700 leading-relaxed">
                        <strong className="font-bold text-slate-900">Why it matches: </strong>
                        {product.matchReason || 'High match for your current preferences and budget.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProduct(product);
                    }}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors text-center cursor-pointer"
                  >
                    View Details
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleAddToCart(product, e)}
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors text-center shadow-xs cursor-pointer"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Feedback Adjustment Box (Exact Stitch Screen 4 Feature) */}
      <div className="bg-white rounded-2xl border-l-4 border-l-purple-600 border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <span className="w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full absolute -bottom-0.5 -right-0.5"></span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Not quite what you're looking for?</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Help me find something better for you. What should I adjust?
            </p>
          </div>
        </div>

        {/* 3 Feedback Adjustment Pills */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
          <button
            onClick={() => setSearchFilterAdjustment(searchFilterAdjustment === 'too-expensive' ? null : 'too-expensive')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              searchFilterAdjustment === 'too-expensive'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Too expensive</span>
          </button>

          <button
            onClick={() => setSearchFilterAdjustment(searchFilterAdjustment === 'dont-like-design' ? null : 'dont-like-design')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              searchFilterAdjustment === 'dont-like-design'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Don't like the design</span>
          </button>

          <button
            onClick={() => setSearchFilterAdjustment(searchFilterAdjustment === 'need-better-features' ? null : 'need-better-features')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              searchFilterAdjustment === 'need-better-features'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Need better features</span>
          </button>
        </div>
      </div>
    </div>
  );
}
