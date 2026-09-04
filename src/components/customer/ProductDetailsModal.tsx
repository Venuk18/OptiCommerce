import React, { useEffect, useState } from 'react';
import { Product, CommercialOffer } from '../../types';
import { useCommerce } from '../../context/CommerceContext';
import { eventService } from '../../services/event.service';
import { recommendationService } from '../../services/recommendation.service';
import { getAnonymousSessionId } from '../../services/event.service';
import { CommercialOfferCard } from './CommercialOfferCard';
import { SaleRecoverySection } from './SaleRecoverySection';
import { 
  X, 
  Star, 
  ShoppingBag, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Plus,
  ArrowRight,
  Loader2
} from 'lucide-react';

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
  onOpenCart: () => void;
}

export function ProductDetailsModal({ product: initialProduct, onClose, onOpenCart }: ProductDetailsModalProps) {
  const {
    addToCart,
    formatINR,
    constraints,
    products,
    loadProductDetails,
    store,
    conversationState,
    setConversationState,
    aiChatTurns,
    cart,
    serverCart,
  } = useCommerce();
  const [product, setProduct] = useState<Product>(initialProduct);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showSaleRecovery, setShowSaleRecovery] = useState(false);

  // Phase 7: Conversational explicit OFFER_REQUEST state
  const [isRequestingOffer, setIsRequestingOffer] = useState(false);
  const [offerState, setOfferState] = useState<'IDLE' | 'OFFER_AVAILABLE' | 'NO_OFFER'>('IDLE');
  const [activeOffer, setActiveOffer] = useState<CommercialOffer | null>(null);
  const [offerMessage, setOfferMessage] = useState<string | null>(null);

  // Track PRODUCT_VIEW commerce event on open (non-blocking)
  useEffect(() => {
    const storeIdToTrack = store?.id || initialProduct?.storeId;
    if (storeIdToTrack && initialProduct?.id) {
      eventService.trackEvent({
        storeId: storeIdToTrack,
        eventType: 'PRODUCT_VIEW',
        productId: initialProduct.id,
        metadata: {
          name: initialProduct.name,
          category: initialProduct.category,
          price: initialProduct.basePrice,
        },
      });
    }
  }, [initialProduct.id, initialProduct.name, initialProduct.category, initialProduct.basePrice, initialProduct.storeId, store?.id]);

  // Fetch live product details on open from GET /api/products/:id
  useEffect(() => {
    let isMounted = true;
    if (initialProduct?.id) {
      setIsLoadingDetails(true);
      loadProductDetails(initialProduct.id)
        .then((liveProd) => {
          if (isMounted && liveProd) {
            setProduct(liveProd);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingDetails(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [initialProduct.id, loadProductDetails]);

  // Handle switching active product when customer clicks an alternative
  const handleSelectAlternative = (altProduct: Product) => {
    setProduct(altProduct);
    setShowSaleRecovery(false);
  };

  // Find related/cross-sell item if enabled in AI Control
  const crossSellItem = products.find(p => p.id !== product.id && p.category === product.category) || 
                        products.find(p => p.id !== product.id) || 
                        null;

  const handleAddMain = () => {
    addToCart(product, 1);
    onOpenCart();
  };

  const handleAddBundle = () => {
    addToCart(product, 1);
    if (crossSellItem) {
      addToCart(crossSellItem, 1);
    }
    onOpenCart();
  };

  const handleRequestPriceReduction = async () => {
    if (isRequestingOffer) return;
    setIsRequestingOffer(true);

    try {
      const resolvedStoreId = store?.id || product.storeId || '';
      const sessionId = getAnonymousSessionId();

      const cartProductIds = Array.from(
        new Set([
          ...cart.map((item) => item.product?.id),
          ...(serverCart?.items || []).map((item) => item.productId),
        ])
      ).filter(Boolean) as string[];

      const recentHistory = aiChatTurns
        .slice(-5)
        .flatMap((turn) => [
          { role: 'user' as const, content: turn.userPrompt },
          { role: 'assistant' as const, content: turn.assistantSummary || '' },
        ])
        .filter((msg) => Boolean(msg.content));

      const response = await recommendationService.recommend({
        storeId: resolvedStoreId,
        query: 'Is there any reduced price?',
        focusedProductId: product.id,
        sessionId,
        conversationContext: {
          history: recentHistory,
          state: conversationState,
        },
        cartProductIds,
      });

      if (response.conversationState) {
        setConversationState(response.conversationState);
      }

      if (
        response.commercialOffer &&
        response.commercialOffer.type !== 'NO_OFFER' &&
        (response.commercialOffer.discountPercent || 0) > 0
      ) {
        setActiveOffer(response.commercialOffer);
        setOfferState('OFFER_AVAILABLE');
        setOfferMessage(response.message || 'I found an eligible price reduction for this product.');
      } else {
        setActiveOffer(null);
        setOfferState('NO_OFFER');
        setOfferMessage(
          response.message || "I couldn't find an eligible price reduction for this product right now."
        );
      }
    } catch (err: any) {
      console.warn('[ProductDetailsModal] Offer request error:', err);
      setActiveOffer(null);
      setOfferState('NO_OFFER');
      setOfferMessage("I couldn't find an eligible price reduction for this product right now.");
    } finally {
      setIsRequestingOffer(false);
    }
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
            {product.brand && (
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                {product.brand}
              </span>
            )}
            {product.matchScore && (
              <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold">
                ★ {product.matchScore}% Match
              </span>
            )}
            {isLoadingDetails && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
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

            {/* Standard Add to Cart button */}
            <button
              id="add-to-cart-standard-btn"
              onClick={handleAddMain}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Cart (Standard)</span>
            </button>

            {/* Conversational Price Reduction Entry Point (Directly below Add to Cart) */}
            {offerState === 'IDLE' && (
              <button
                id="ask-price-reduction-btn"
                type="button"
                onClick={handleRequestPriceReduction}
                disabled={isRequestingOffer}
                className="w-full py-2 px-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 active:scale-[0.99] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isRequestingOffer ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Checking available price reduction...</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">💬</span>
                    <span>Is there any reduced price?</span>
                  </>
                )}
              </button>
            )}

            {/* If offer exists: render existing CommercialOfferCard */}
            {offerState === 'OFFER_AVAILABLE' && activeOffer && (
              <div className="pt-2 animate-fadeIn">
                <CommercialOfferCard
                  offer={activeOffer}
                  product={product}
                  onOpenCart={onOpenCart}
                />
              </div>
            )}

            {/* If no offer exists: render conversational natural fallback */}
            {offerState === 'NO_OFFER' && (
              <div
                id="no-offer-fallback"
                className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5 text-xs text-slate-600 animate-fadeIn"
              >
                <span className="text-base shrink-0">💬</span>
                <span className="font-medium leading-relaxed">
                  {offerMessage || "I couldn't find an eligible price reduction for this product right now."}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Phase 5E: Sale Recovery Section (Triggered on OFFER_REJECTED) */}
        {showSaleRecovery && (
          <SaleRecoverySection
            rejectedProduct={product}
            onSelectAlternative={handleSelectAlternative}
            onOpenCart={onOpenCart}
          />
        )}

        {/* Features / Highlights */}
        {product.features && product.features.length > 0 && (
          <div className="space-y-2.5 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Key Features</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {product.features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg text-slate-700">
                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Specifications */}
        {product.specs && Object.keys(product.specs).length > 0 && (
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
        {constraints.crossSellingIntelligence && crossSellItem && !showSaleRecovery && (
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
