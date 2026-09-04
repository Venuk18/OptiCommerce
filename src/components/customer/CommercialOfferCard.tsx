import React, { useState } from 'react';
import { CommercialOffer, Product } from '../../types';
import { useCommerce } from '../../context/CommerceContext';
import { commercialService } from '../../services/commercial.service';
import {
  Sparkles,
  Tag,
  CheckCircle2,
  X,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Percent,
  Clock,
  Package,
} from 'lucide-react';

interface CommercialOfferCardProps {
  offer: CommercialOffer;
  product?: Product;
  onOpenCart?: () => void;
  className?: string;
}

export function CommercialOfferCard({
  offer,
  product,
  onOpenCart,
  className = '',
}: CommercialOfferCardProps) {
  const { store, products, addToCart, formatINR } = useCommerce();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [recoveryAlternatives, setRecoveryAlternatives] = useState<any[]>(
    offer.recoveryAlternatives || []
  );

  const matchedProduct = product || products.find((p) => p.id === offer.productId);
  const resolvedStoreId = store?.id || matchedProduct?.storeId || '';

  const handleAccept = async () => {
    if (!offer.productId || !resolvedStoreId) {
      if (matchedProduct) {
        addToCart(matchedProduct, 1, {
          discountPercent: offer.discountPercent || 0,
          discountReason: offer.reason,
        });
        setIsAccepted(true);
      }
      return;
    }

    setIsAccepting(true);
    try {
      await commercialService.acceptOffer({
        storeId: resolvedStoreId,
        productId: offer.productId,
        offerType: offer.type,
        discountPercent: offer.discountPercent || 0,
        token: offer.token,
      });

      if (matchedProduct) {
        addToCart(matchedProduct, 1, {
          discountPercent: offer.discountPercent || 0,
          discountReason: offer.reason,
        });
      }
      setIsAccepted(true);
    } catch (err: any) {
      console.warn('[CommercialOfferCard] Accept error notice:', err?.message || err);
      if (matchedProduct) {
        addToCart(matchedProduct, 1, {
          discountPercent: offer.discountPercent || 0,
          discountReason: offer.reason,
        });
        setIsAccepted(true);
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!offer.productId || !resolvedStoreId) {
      setIsRejected(true);
      return;
    }

    setIsRejecting(true);
    try {
      const res = await commercialService.rejectOffer({
        storeId: resolvedStoreId,
        productId: offer.productId,
        offerType: offer.type,
        reason: 'Customer declined in chat',
      });
      setIsRejected(true);
      if (res.recoveryAlternatives && res.recoveryAlternatives.length > 0) {
        setRecoveryAlternatives(res.recoveryAlternatives);
      }
    } catch (err: any) {
      console.warn('[CommercialOfferCard] Reject notice:', err?.message || err);
      setIsRejected(true);
    } finally {
      setIsRejecting(false);
    }
  };

  if (offer.type === 'NO_OFFER') {
    return null;
  }

  // Render accepted state
  if (isAccepted) {
    return (
      <div
        id="commercial-offer-accepted"
        className={`bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 sm:p-5 text-slate-800 shadow-xs flex items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Offer Applied to Cart!</h4>
            <p className="text-xs text-slate-600">
              {offer.discountPercent ? `${offer.discountPercent}% discount reserved` : 'Special privilege applied'} for {offer.productName || 'your item'}.
            </p>
          </div>
        </div>
        {onOpenCart && (
          <button
            id="view-cart-after-offer"
            onClick={onOpenCart}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>View Cart</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Render rejected state with optional recovery
  if (isRejected) {
    return (
      <div
        id="commercial-offer-declined"
        className={`bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-slate-700 space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Offer declined</span>
          <span className="text-[11px] text-slate-400">Standard pricing remains active</span>
        </div>
        {recoveryAlternatives.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600" />
              Recommended In-Stock Alternatives:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recoveryAlternatives.map((alt) => (
                <div
                  key={alt.id}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{alt.name}</p>
                    <p className="text-[11px] font-bold text-blue-700">{formatINR(alt.price)}</p>
                  </div>
                  {alt.savingsVsRejected > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md">
                      Save {formatINR(alt.savingsVsRejected)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Discount Offer (SMALL_DISCOUNT or TARGETED_OFFER)
  if (offer.type === 'SMALL_DISCOUNT' || offer.type === 'TARGETED_OFFER') {
    return (
      <div
        id="commercial-offer-discount-card"
        className={`bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-amber-50/70 border border-amber-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 ${className}`}
      >
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-amber-600 text-white text-[10px] font-extrabold tracking-wider rounded-lg flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Price reduction available
          </span>
          <span className="text-[11px] text-amber-900/70 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Limited session offer
          </span>
        </div>

        <div className="space-y-1.5">
          <h4 className="text-sm sm:text-base font-bold text-slate-900">
            {offer.productName || 'Price Reduction Opportunity'}
          </h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {offer.explanation || 'An eligible price reduction has been found for this product.'}
          </p>
        </div>

        <div className="flex items-baseline gap-3 pt-1">
          {offer.finalPrice !== undefined && (
            <span className="text-xl sm:text-2xl font-black text-emerald-700">
              {formatINR(offer.finalPrice)}
            </span>
          )}
          {offer.originalPrice !== undefined && offer.originalPrice > (offer.finalPrice || 0) && (
            <span className="text-sm font-semibold text-slate-400 line-through">
              {formatINR(offer.originalPrice)}
            </span>
          )}
          {offer.discountPercent !== undefined && offer.discountPercent > 0 && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">
              Save {offer.discountPercent}% ({formatINR((offer.originalPrice || 0) - (offer.finalPrice || 0))})
            </span>
          )}
        </div>

        <div className="pt-1">
          <button
            id="accept-commercial-offer-btn"
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>{isAccepting ? 'Applying...' : 'Apply offer & reduce price'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Render BUNDLE_VALUE
  if (offer.type === 'BUNDLE_VALUE' && offer.bundleOpportunity) {
    const bundle = offer.bundleOpportunity;
    return (
      <div
        id="commercial-offer-bundle-card"
        className={`bg-blue-50/70 border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 ${className}`}
      >
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-lg flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Recommended Bundle Value
          </span>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
            Save {formatINR(bundle.savings)}
          </span>
        </div>

        <div className="space-y-1">
          <h4 className="text-sm sm:text-base font-bold text-slate-900">{bundle.bundleName}</h4>
          <p className="text-xs text-slate-600">{bundle.bundleSummary}</p>
        </div>

        <div className="flex items-baseline gap-3">
          <span className="text-xl font-black text-blue-900">{formatINR(bundle.bundlePrice)}</span>
          <span className="text-sm font-semibold text-slate-400 line-through">
            {formatINR(bundle.originalTotal)}
          </span>
        </div>

        <div className="pt-1">
          <button
            id="accept-bundle-offer-btn"
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Apply offer & reduce price</span>
          </button>
        </div>
      </div>
    );
  }

  // Render NON_PRICE_INCENTIVE
  if (offer.type === 'NON_PRICE_INCENTIVE') {
    return (
      <div
        id="commercial-offer-non-price-card"
        className={`bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 ${className}`}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>OptiCommerce Store Guarantee Included</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          {offer.nonPriceIncentive || offer.explanation}
        </p>
        <div className="flex items-baseline gap-2">
          {offer.finalPrice !== undefined && (
            <span className="text-lg font-black text-slate-900">{formatINR(offer.finalPrice)}</span>
          )}
        </div>
        {matchedProduct && (
          <button
            id="add-standard-price-btn"
            onClick={() => addToCart(matchedProduct, 1)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Add to Cart at Best Price</span>
          </button>
        )}
      </div>
    );
  }

  // Render SALE_RECOVERY
  if (offer.type === 'SALE_RECOVERY' && recoveryAlternatives.length > 0) {
    return (
      <div
        id="commercial-offer-recovery-card"
        className={`bg-indigo-50/50 border border-indigo-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 ${className}`}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
          <Tag className="w-4 h-4 text-indigo-600" />
          <span>Budget-Friendly In-Stock Alternatives</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {offer.explanation || 'Here are top-performing alternatives that fit your budget:'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {recoveryAlternatives.map((alt) => {
            const fullProd = products.find((p) => p.id === alt.id);
            return (
              <div
                key={alt.id}
                className="p-3 bg-white border border-indigo-100 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{alt.name}</p>
                  <p className="text-xs font-extrabold text-indigo-700">{formatINR(alt.price)}</p>
                </div>
                {fullProd && (
                  <button
                    onClick={() => addToCart(fullProd, 1)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors shrink-0 cursor-pointer"
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
