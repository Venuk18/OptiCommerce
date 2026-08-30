import React from 'react';
import { Product } from '../../types';
import { useCommerce } from '../../context/CommerceContext';
import { 
  X, 
  Star, 
  ShoppingBag, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Plus,
  ArrowRight
} from 'lucide-react';

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
  onOpenCart: () => void;
}

export function ProductDetailsModal({ product, onClose, onOpenCart }: ProductDetailsModalProps) {
  const { addToCart, formatINR, constraints, products } = useCommerce();

  // Find related/cross-sell item if enabled in AI Control
  const crossSellItem = products.find(p => p.id !== product.id && p.category === 'Audio') || products[1];

  const handleAddMain = () => {
    addToCart(product, 1);
    onOpenCart();
  };

  const handleAddBundle = () => {
    addToCart(product, 1);
    addToCart(crossSellItem, 1);
    onOpenCart();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-fadeIn max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">
              {product.category}
            </span>
            {product.matchScore && (
              <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold">
                ★ {product.matchScore}% Match
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Hero */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          <div className="bg-slate-50 rounded-2xl p-6 flex items-center justify-center aspect-square border border-slate-100">
            <img
              src={product.image}
              alt={product.name}
              className="max-h-56 object-contain mix-blend-multiply"
            />
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{product.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-xs text-slate-500 font-semibold">({product.ratingCount} reviews)</span>
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{formatINR(product.basePrice)}</span>
              <span className="text-xs text-emerald-600 font-bold">In Stock ({product.stock} units)</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {product.description}
            </p>

            <button
              onClick={handleAddMain}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Cart</span>
            </button>
          </div>
        </div>

        {/* Specifications */}
        {product.specs && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Technical Specifications</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(product.specs).map(([key, val]) => (
                <div key={key} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">{key}</span>
                  <span className="text-slate-800 font-bold">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Smart Cross-Sell Bundle (Conditioned on Merchant AI Control) */}
        {constraints.crossSellingIntelligence && (
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                AI Cross-Sell Intelligent Bundle
              </h4>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={crossSellItem.image}
                  alt={crossSellItem.name}
                  className="w-10 h-10 object-cover rounded-lg border border-purple-200"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900">{crossSellItem.name}</p>
                  <p className="text-[11px] text-purple-800 font-semibold">Bundle & Save 5% extra</p>
                </div>
              </div>
              <button
                onClick={handleAddBundle}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer shadow-xs"
              >
                Add Bundle
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
