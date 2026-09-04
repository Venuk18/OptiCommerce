import React, { useEffect, useState, useRef } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { cartService } from '../../services/cart.service';
import { eventService } from '../../services/event.service';
import { BundleSuggestion, BundleOpportunity } from '../../types';
import { Sparkles, Plus, Check, Loader2, Tag, PackagePlus } from 'lucide-react';

interface BundleSuggestionsSectionProps {
  baseProductId?: string | null;
  onItemAdded?: (addedProductId: string) => void;
}

export function BundleSuggestionsSection({ baseProductId, onItemAdded }: BundleSuggestionsSectionProps) {
  const { store, formatINR, addToCart, products, serverCart } = useCommerce();
  const [suggestions, setSuggestions] = useState<BundleSuggestion[]>([]);
  const [bundleOpportunity, setBundleOpportunity] = useState<BundleOpportunity | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [addedItemIds, setAddedItemIds] = useState<Set<string>>(new Set());
  
  // Track visibility event once per unique base product
  const lastTrackedBaseIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!store?.id) {
      setSuggestions([]);
      setBundleOpportunity(null);
      return;
    }

    // Only fetch if baseProductId exists OR if cart has items to complement
    const hasCartItems = (serverCart?.items || []).length > 0;
    if (!baseProductId && !hasCartItems) {
      setSuggestions([]);
      setBundleOpportunity(null);
      return;
    }

    setIsLoading(true);

    // Call Phase 6 Cart-Aware Cross-Sell endpoint
    cartService.getCartCrossSell(store.id, {
      focusedProductId: baseProductId || undefined,
      limit: 3,
    })
      .then((data) => {
        if (isMounted && data && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
          setBundleOpportunity(data.bundleOpportunity || null);
          setExplanation(data.explanation || null);

          // Track RECOMMENDATION_VIEW when suggestions are successfully loaded and visible
          const currentTrackingId = baseProductId || 'cart-cross-sell';
          if (data.suggestions.length > 0 && lastTrackedBaseIdRef.current !== currentTrackingId) {
            lastTrackedBaseIdRef.current = currentTrackingId;
            eventService.trackEvent({
              storeId: store.id,
              eventType: 'RECOMMENDATION_VIEW',
              productId: null,
              metadata: {
                source: 'BUNDLE_CROSS_SELL',
                baseProductId: baseProductId || null,
                count: data.suggestions.length,
              },
            });
          }
        }
      })
      .catch((err) => {
        // Non-blocking fallback to phase 4 bundle suggestions
        console.warn('[Bundle Engine] Cart cross-sell fallback:', err?.message || err);
        if (isMounted && baseProductId) {
          cartService.getBundleSuggestions(store.id, baseProductId, 3)
            .then((legacyData) => {
              if (isMounted && legacyData && Array.isArray(legacyData.suggestions)) {
                setSuggestions(legacyData.suggestions);
              }
            })
            .catch(() => {
              if (isMounted) setSuggestions([]);
            });
        } else if (isMounted) {
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [store?.id, baseProductId, serverCart?.items?.length]);

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-800">Complete your setup</span>
          <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin ml-auto" />
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-white/60 rounded-xl animate-pulse border border-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  const handleQuickAdd = (suggestion: BundleSuggestion) => {
    if (addedItemIds.has(suggestion.productId)) return;

    // 1. Track RECOMMENDATION_CLICK
    if (store?.id) {
      eventService.trackEvent({
        storeId: store.id,
        eventType: 'RECOMMENDATION_CLICK',
        productId: suggestion.productId,
        metadata: {
          source: 'BUNDLE_CROSS_SELL',
          baseProductId: baseProductId || null,
          bundleScore: suggestion.bundleScore,
        },
      });
    }

    // 2. Locate product object in catalog state or build fallback
    const matchedProduct = products.find(p => p.id === suggestion.productId) || {
      id: suggestion.productId,
      name: suggestion.name,
      category: suggestion.category,
      brand: suggestion.brand,
      basePrice: suggestion.price,
      costPrice: Math.round(suggestion.price * 0.6),
      marginPercent: 40,
      stock: suggestion.stock,
      rating: 4.8,
      ratingCount: 24,
      image: suggestion.image || 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&auto=format&fit=crop&q=80',
      description: suggestion.reason,
      tags: [suggestion.category],
      aiDiscountEligible: false,
      activeDiscountPercent: 0,
      isLive: true,
      storeId: store?.id,
    };

    // 3. Quick-Add to cart
    addToCart(matchedProduct, 1);
    setAddedItemIds(prev => new Set(prev).add(suggestion.productId));

    if (onItemAdded) {
      onItemAdded(suggestion.productId);
    }
  };

  const handleAddEntireBundle = () => {
    if (!bundleOpportunity) return;
    for (const bProd of bundleOpportunity.products) {
      const alreadyInCart = (serverCart?.items || []).some(i => i.productId === bProd.id);
      if (!alreadyInCart && !addedItemIds.has(bProd.id)) {
        const catalogP = products.find(p => p.id === bProd.id);
        const pToAdd = catalogP || {
          id: bProd.id,
          name: bProd.name,
          category: bProd.category,
          brand: bProd.brand || '',
          basePrice: bProd.price,
          costPrice: Math.round(bProd.price * 0.6),
          marginPercent: 40,
          stock: bProd.stock,
          rating: 4.8,
          ratingCount: 20,
          image: bProd.image || '',
          description: bProd.category,
          tags: [bProd.category],
          aiDiscountEligible: false,
          activeDiscountPercent: 0,
          isLive: true,
          storeId: store?.id,
        };
        addToCart(pToAdd, 1);
        setAddedItemIds(prev => new Set(prev).add(bProd.id));
      }
    }
  };

  return (
    <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-extrabold text-slate-900">Complete your setup</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {bundleOpportunity?.discountEligible && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" /> Save {formatINR(bundleOpportunity.savings)} (10% off)
            </span>
          )}
          <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
            Complementary
          </span>
        </div>
      </div>

      {explanation && (
        <p className="text-[11px] text-slate-600 leading-relaxed italic">
          {explanation}
        </p>
      )}

      <div className="space-y-2.5">
        {suggestions.map((item) => {
          const isAdded = addedItemIds.has(item.productId) || (serverCart?.items || []).some(ci => ci.productId === item.productId);

          return (
            <div
              key={item.productId}
              className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={item.image || 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&auto=format&fit=crop&q=80'}
                  alt={item.name}
                  className="w-11 h-11 object-cover rounded-lg border border-slate-100 bg-slate-50 shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                  <p className="text-[11px] text-slate-500 truncate">{item.reason}</p>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                    {formatINR(item.price)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleQuickAdd(item)}
                disabled={isAdded}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
                  isAdded
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                }`}
              >
                {isAdded ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>In Cart</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {bundleOpportunity && bundleOpportunity.discountEligible && (
        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] text-slate-400 line-through">
                {formatINR(bundleOpportunity.originalTotal)}
              </span>
              <span className="text-xs font-extrabold text-blue-700">
                {formatINR(bundleOpportunity.bundlePrice)}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              Bundle total ({bundleOpportunity.products.length} items)
            </span>
          </div>
          <button
            onClick={handleAddEntireBundle}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>Add Bundle</span>
          </button>
        </div>
      )}
    </div>
  );
}
