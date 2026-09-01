import React, { useEffect, useState, useRef } from 'react';
import { ProductAlternativeItem, Product } from '../../types';
import { useCommerce } from '../../context/CommerceContext';
import { revenueService } from '../../services/revenue.service';
import { eventService } from '../../services/event.service';
import { 
  Sparkles, 
  ArrowRight, 
  ShoppingBag, 
  Loader2, 
  TrendingDown, 
  Layers, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface SaleRecoverySectionProps {
  rejectedProduct: Product;
  userQuery?: string;
  onSelectAlternative?: (product: Product) => void;
  onOpenCart?: () => void;
  className?: string;
}

export function SaleRecoverySection({
  rejectedProduct,
  userQuery,
  onSelectAlternative,
  onOpenCart,
  className = '',
}: SaleRecoverySectionProps) {
  const { store, addToCart, formatINR } = useCommerce();
  const [alternatives, setAlternatives] = useState<ProductAlternativeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [selectedAltId, setSelectedAltId] = useState<string | null>(null);

  const resolvedStoreId = store?.id || rejectedProduct.storeId;
  const hasTrackedViewRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    hasTrackedViewRef.current = false;

    if (!resolvedStoreId || !rejectedProduct?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    revenueService
      .recoverSale({
        storeId: resolvedStoreId,
        rejectedProductId: rejectedProduct.id,
        userQuery,
        limit: 3,
      })
      .then((data) => {
        if (!isMounted) return;
        const alts = data.alternatives || [];
        setAlternatives(alts);

        // Track RECOMMENDATION_VIEW commerce event for customer recommendation tracking
        if (alts.length > 0 && !hasTrackedViewRef.current) {
          hasTrackedViewRef.current = true;
          for (const alt of alts) {
            eventService.trackEvent({
              storeId: resolvedStoreId,
              eventType: 'RECOMMENDATION_VIEW',
              productId: alt.id,
              metadata: {
                source: 'SALE_RECOVERY',
                rejectedProductId: rejectedProduct.id,
                similarityScore: alt.similarityScore,
                price: alt.price,
              },
            });
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[Sale Recovery] Notice:', err?.message || err);
        setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [rejectedProduct.id, resolvedStoreId, userQuery]);

  const handleAlternativeClick = (alt: ProductAlternativeItem) => {
    // 1. Track RECOMMENDATION_CLICK commerce event (non-blocking)
    if (resolvedStoreId) {
      eventService.trackEvent({
        storeId: resolvedStoreId,
        eventType: 'RECOMMENDATION_CLICK',
        productId: alt.id,
        metadata: {
          source: 'SALE_RECOVERY',
          rejectedProductId: rejectedProduct.id,
          similarityScore: alt.similarityScore,
          price: alt.price,
        },
      });
    }

    // 2. Convert to UI product model and trigger selection
    const fullProduct: Product = {
      id: alt.id,
      storeId: resolvedStoreId,
      name: alt.name,
      description: alt.description || '',
      category: alt.category,
      brand: alt.brand || undefined,
      basePrice: alt.price,
      costPrice: 0,
      marginPercent: 0,
      stock: alt.stock,
      image: (alt.images && alt.images[0]) || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
      images: alt.images || [],
      rating: 4.8,
      ratingCount: 42,
      features: alt.features || [],
      tags: alt.tags || [],
      matchScore: Math.round(alt.similarityScore * 100),
      aiDiscountEligible: true,
      activeDiscountPercent: 0,
      isLive: true,
    };

    if (onSelectAlternative) {
      onSelectAlternative(fullProduct);
    }
  };

  const handleQuickAdd = (e: React.MouseEvent, alt: ProductAlternativeItem) => {
    e.stopPropagation();

    // Track RECOMMENDATION_CLICK
    if (resolvedStoreId) {
      eventService.trackEvent({
        storeId: resolvedStoreId,
        eventType: 'RECOMMENDATION_CLICK',
        productId: alt.id,
        metadata: {
          action: 'QUICK_ADD',
          source: 'SALE_RECOVERY',
          rejectedProductId: rejectedProduct.id,
          price: alt.price,
        },
      });
    }

    const fullProduct: Product = {
      id: alt.id,
      storeId: resolvedStoreId,
      name: alt.name,
      description: alt.description || '',
      category: alt.category,
      brand: alt.brand || undefined,
      basePrice: alt.price,
      costPrice: 0,
      marginPercent: 0,
      stock: alt.stock,
      image: (alt.images && alt.images[0]) || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
      images: alt.images || [],
      rating: 4.8,
      ratingCount: 42,
      features: alt.features || [],
      tags: alt.tags || [],
      matchScore: Math.round(alt.similarityScore * 100),
      aiDiscountEligible: true,
      activeDiscountPercent: 0,
      isLive: true,
    };

    addToCart(fullProduct, 1);
    setSelectedAltId(alt.id);
    if (onOpenCart) {
      onOpenCart();
    }
  };

  if (isLoading) {
    return (
      <div className={`p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-center gap-2.5 text-xs text-slate-500 animate-pulse ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        <span>Finding real in-stock alternatives tailored to your budget...</span>
      </div>
    );
  }

  if (hasError || alternatives.length === 0) {
    return null;
  }

  return (
    <div className={`p-4 sm:p-5 bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 border border-slate-200/90 rounded-2xl space-y-4 animate-fadeIn ${className}`}>
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 text-white rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 tracking-wide uppercase">
              Similar In-Stock Alternatives
            </h4>
            <p className="text-[11px] text-slate-500">
              Handpicked options matching your criteria and budget
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-extrabold uppercase">
          {alternatives.length} Available
        </span>
      </div>

      {/* Alternative Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {alternatives.map((alt) => {
          const isCheaper = alt.priceComparison === 'cheaper';
          const isSelected = selectedAltId === alt.id;
          const thumbnail = (alt.images && alt.images[0]) || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';

          return (
            <div
              key={alt.id}
              onClick={() => handleAlternativeClick(alt)}
              className={`group relative p-3 bg-white border rounded-xl shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              {/* Top Highlights Tag */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-bold">
                  {Math.round(alt.similarityScore * 100)}% Match
                </span>

                {isCheaper && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                    <TrendingDown className="w-3 h-3" />
                    <span>Save {formatINR(Math.abs(alt.priceDifference))}</span>
                  </span>
                )}
              </div>

              {/* Product Visual & Identity */}
              <div className="space-y-2">
                <div className="aspect-square bg-slate-50 rounded-lg p-2 flex items-center justify-center border border-slate-100 overflow-hidden">
                  <img
                    src={thumbnail}
                    alt={alt.name}
                    className="max-h-24 object-contain group-hover:scale-105 transition-transform duration-200 mix-blend-multiply"
                  />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {alt.name}
                  </p>
                  {alt.brand && (
                    <p className="text-[10px] text-slate-400 font-medium">{alt.brand}</p>
                  )}
                </div>

                {alt.matchHighlights && alt.matchHighlights.length > 0 && (
                  <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded-md line-clamp-1">
                    {alt.matchHighlights[0]}
                  </div>
                )}
              </div>

              {/* Price & Action */}
              <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-extrabold text-slate-900">
                    {formatINR(alt.price)}
                  </span>
                </div>

                <button
                  onClick={(e) => handleQuickAdd(e, alt)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-blue-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  title="Add this alternative to cart"
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
