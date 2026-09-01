import React, { useEffect, useState, useRef } from 'react';
import { Product, OfferState } from '../../types';
import { useCommerce } from '../../context/CommerceContext';
import { revenueService } from '../../services/revenue.service';
import { eventService, getAnonymousSessionId } from '../../services/event.service';
import { 
  Sparkles, 
  Tag, 
  CheckCircle2, 
  X, 
  ShoppingBag, 
  ArrowRight,
  ShieldCheck,
  Loader2
} from 'lucide-react';

interface CustomerOfferBannerProps {
  product: Product;
  onOfferApplied?: () => void;
  onOfferRejected?: () => void;
  onOpenCart?: () => void;
  className?: string;
}

// In-memory cache to prevent duplicate optimization requests for the same session+store+product
const offerCache = new Map<string, {
  recommendedDiscount: number;
  recommendedPrice: number;
  price: number;
  timestamp: number;
}>();

export function CustomerOfferBanner({
  product,
  onOfferApplied,
  onOfferRejected,
  onOpenCart,
  className = '',
}: CustomerOfferBannerProps) {
  const { store, addToCart, formatINR } = useCommerce();
  const [offerState, setOfferState] = useState<OfferState>('IDLE');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountedPrice, setDiscountedPrice] = useState<number>(product.basePrice);
  const [originalPrice, setOriginalPrice] = useState<number>(product.basePrice);
  
  // Track whether OFFER_VIEW has already been fired for this render cycle
  const hasTrackedViewRef = useRef<boolean>(false);
  const activeProductIdRef = useRef<string>(product.id);

  const resolvedStoreId = store?.id || product.storeId || '';
  const sessionId = getAnonymousSessionId();
  const cacheKey = `${sessionId}:${resolvedStoreId}:${product.id}`;

  useEffect(() => {
    let isMounted = true;
    hasTrackedViewRef.current = false;
    activeProductIdRef.current = product.id;

    if (!resolvedStoreId || !product.id) {
      setOfferState('IDLE');
      return;
    }

    // Check in-memory cache first to avoid redundant server requests
    const cached = offerCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
      if (cached.recommendedDiscount > 0) {
        setDiscountPercent(cached.recommendedDiscount);
        setDiscountedPrice(cached.recommendedPrice);
        setOriginalPrice(cached.price);
        setOfferState('AVAILABLE');

        // Track OFFER_VIEW if not yet tracked
        if (!hasTrackedViewRef.current) {
          hasTrackedViewRef.current = true;
          eventService.trackEvent({
            storeId: resolvedStoreId,
            eventType: 'OFFER_VIEW',
            productId: product.id,
            metadata: {
              originalPrice: cached.price,
              discountPercentage: cached.recommendedDiscount,
              discountedPrice: cached.recommendedPrice,
              savings: cached.price - cached.recommendedPrice,
            },
          });
        }
      } else {
        setOfferState('NO_DISCOUNT');
      }
      return;
    }

    // Request server's optimized offer from Phase 5C
    setOfferState('LOADING');

    revenueService
      .getOptimizedOffer(resolvedStoreId, product.id)
      .then((data) => {
        if (!isMounted || activeProductIdRef.current !== product.id) return;

        // Cache server response
        offerCache.set(cacheKey, {
          recommendedDiscount: data.recommendedDiscount,
          recommendedPrice: data.recommendedPrice,
          price: data.price,
          timestamp: Date.now(),
        });

        setOriginalPrice(data.price || product.basePrice);

        if (data.recommendedDiscount > 0) {
          setDiscountPercent(data.recommendedDiscount);
          setDiscountedPrice(data.recommendedPrice);
          setOfferState('AVAILABLE');

          // Track OFFER_VIEW commerce event (non-blocking)
          if (!hasTrackedViewRef.current) {
            hasTrackedViewRef.current = true;
            eventService.trackEvent({
              storeId: resolvedStoreId,
              eventType: 'OFFER_VIEW',
              productId: product.id,
              metadata: {
                originalPrice: data.price || product.basePrice,
                discountPercentage: data.recommendedDiscount,
                discountedPrice: data.recommendedPrice,
                savings: (data.price || product.basePrice) - data.recommendedPrice,
              },
            });
          }
        } else {
          setOfferState('NO_DISCOUNT');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        // Non-blocking graceful error recovery: fallback quietly without disrupting storefront
        console.warn('[Offer Optimizer] Notice:', err?.message || err);
        setOfferState('ERROR');
      });

    return () => {
      isMounted = false;
    };
  }, [product.id, resolvedStoreId, cacheKey, product.basePrice]);

  const savingsAmount = Math.max(0, originalPrice - discountedPrice);

  const handleAcceptOffer = () => {
    // 1. Track OFFER_ACCEPTED commerce event (non-blocking)
    if (resolvedStoreId) {
      eventService.trackEvent({
        storeId: resolvedStoreId,
        eventType: 'OFFER_ACCEPTED',
        productId: product.id,
        metadata: {
          originalPrice,
          discountPercentage: discountPercent,
          discountedPrice,
          savings: savingsAmount,
        },
      });
    }

    // 2. Add to cart with the exact server-provided offer
    addToCart(product, 1, {
      discountPercent,
      discountReason: `${discountPercent}% Exclusive Member Offer Applied`,
    });

    setOfferState('ACCEPTED');

    if (onOfferApplied) {
      onOfferApplied();
    }
  };

  const handleRejectOffer = () => {
    // 1. Track OFFER_REJECTED commerce event (non-blocking)
    if (resolvedStoreId) {
      eventService.trackEvent({
        storeId: resolvedStoreId,
        eventType: 'OFFER_REJECTED',
        productId: product.id,
        metadata: {
          originalPrice,
          discountPercentage: discountPercent,
        },
      });
    }

    setOfferState('REJECTED');

    // Trigger Phase 5E Sale Recovery workflow
    if (onOfferRejected) {
      onOfferRejected();
    }
  };

  // State: LOADING
  if (offerState === 'LOADING') {
    return (
      <div className={`p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-2.5 text-xs text-slate-500 animate-pulse ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
        <span>Checking for eligible personalized offers...</span>
      </div>
    );
  }

  // State: ACCEPTED
  if (offerState === 'ACCEPTED') {
    return (
      <div className={`p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-3 animate-fadeIn ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-emerald-900">
              {discountPercent}% Offer Applied to Cart!
            </span>
          </div>
          <span className="text-xs font-extrabold text-emerald-700">
            Saved {formatINR(savingsAmount)}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-emerald-800 font-medium">
            Price in cart: <strong className="font-extrabold text-slate-900">{formatINR(discountedPrice)}</strong>
          </div>
          {onOpenCart && (
            <button
              onClick={onOpenCart}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>View Cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // State: AVAILABLE (Discount > 0)
  if (offerState === 'AVAILABLE') {
    return (
      <div className={`relative p-4 sm:p-5 bg-gradient-to-br from-blue-50/90 via-indigo-50/80 to-purple-50/60 border border-blue-200/90 rounded-2xl shadow-xs space-y-3 animate-fadeIn ${className}`}>
        {/* Top Offer Badge & Close */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-[11px] font-extrabold tracking-wide uppercase shadow-xs">
            <Sparkles className="w-3 h-3 fill-white" />
            <span>Exclusive {discountPercent}% OFF Unlocked</span>
          </div>

          <button
            onClick={handleRejectOffer}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
            title="Dismiss offer"
            aria-label="Dismiss offer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Price Breakdown */}
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-blue-700 tracking-tight">
            {formatINR(discountedPrice)}
          </span>
          <span className="text-sm font-semibold text-slate-400 line-through">
            {formatINR(originalPrice)}
          </span>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-bold">
            Save {formatINR(savingsAmount)}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Special personalized offer applied for your session. Claim now to lock in this price.
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={handleAcceptOffer}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Apply {discountPercent}% Offer & Add</span>
          </button>

          <button
            onClick={handleRejectOffer}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
          >
            No thanks, full price
          </button>
        </div>
      </div>
    );
  }

  // State: NO_DISCOUNT (Phase 5C recommended 0%)
  if (offerState === 'NO_DISCOUNT') {
    return (
      <div className={`p-3 bg-slate-50 border border-slate-200/70 rounded-2xl flex items-center gap-2 text-xs text-slate-600 ${className}`}>
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="font-medium">This product is already at its best available price.</span>
      </div>
    );
  }

  // State: REJECTED
  if (offerState === 'REJECTED') {
    return null;
  }

  // State: ERROR or IDLE -> Render nothing / keep default shopping clean
  return null;
}
