import React, { useState, useRef, useEffect } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { Product } from '../../types';
import { eventService } from '../../services/event.service';
import { 
  Sparkles, 
  Lightbulb, 
  Check, 
  CheckCircle2, 
  Info, 
  Star, 
  Send, 
  SlidersHorizontal, 
  ShoppingCart, 
  ArrowRight,
  Bot,
  Loader2,
  AlertCircle,
  PackageSearch,
  RefreshCw,
  Trophy,
  Scale,
  ShieldAlert,
  PackagePlus,
  Tag,
} from 'lucide-react';
import { CommercialOfferCard } from './CommercialOfferCard';

interface AIChatShoppingViewProps {
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
}

export function AIChatShoppingView({ onSelectProduct, onOpenCart }: AIChatShoppingViewProps) {
  const { 
    aiChatTurns, 
    askAIAssistant, 
    compareProducts,
    addToCart, 
    formatPrice,
    setCustomerTab,
    setManualSearchQuery,
    isAISearchLoading,
    aiSearchError,
    store,
    products,
    serverCart,
  } = useCommerce();

  const [inputPrompt, setInputPrompt] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const latestResponseRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const prevTurnCountRef = useRef(aiChatTurns.length);

  const handleSelectRecommendedProduct = (product: Product, rank: number) => {
    const storeIdToTrack = store?.id || product.storeId;
    if (storeIdToTrack) {
      eventService.trackEvent({
        storeId: storeIdToTrack,
        eventType: 'RECOMMENDATION_CLICK',
        productId: product.id,
        metadata: {
          rank,
          matchScore: product.matchScore,
          matchReason: product.matchReason,
        },
      });
    }
    onSelectProduct(product);
  };

  // Auto-scroll directly to newly generated AI response bubble (not page bottom/footer)
  useEffect(() => {
    if (isAISearchLoading) {
      loadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (aiChatTurns.length > 0 && aiChatTurns.length > prevTurnCountRef.current) {
      latestResponseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevTurnCountRef.current = aiChatTurns.length;
  }, [aiChatTurns, isAISearchLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isAISearchLoading) return;
    askAIAssistant(inputPrompt.trim());
    setInputPrompt('');
  };

  const handleChipClick = (chipText: string) => {
    if (isAISearchLoading) return;
    askAIAssistant(chipText);
  };

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
    setToastMessage(`${product.name} added to cart!`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Get the latest turn or active turns
  const latestTurn = aiChatTurns[aiChatTurns.length - 1];

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC]/50 flex flex-col justify-between pb-12">
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

      {/* Main Conversation Container */}
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 pt-8 space-y-10">
        
        {/* Welcome Empty State if no turns yet */}
        {aiChatTurns.length === 0 && !isAISearchLoading && (
          <div className="text-center py-16 px-4 space-y-4 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">How can I help you shop today?</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Ask for anything in natural language—like "wireless headphones under ₹5,000 with strong bass", "laptops for programming", or "silent wireless mouse".
            </p>
          </div>
        )}

        {/* Render each turn in the AI conversation */}
        {aiChatTurns.map((turn, turnIdx) => (
          <div key={turn.id || turnIdx} className="space-y-6 animate-fadeIn">
            
            {/* User Message Bubble (Right aligned with soft blue/lavender tint) */}
            <div className="flex justify-end">
              <div className="bg-[#EEF4FF] text-slate-900 text-sm sm:text-base font-normal px-6 py-4 rounded-2xl max-w-xl shadow-xs border border-blue-100/80 leading-relaxed">
                {turn.userPrompt}
              </div>
            </div>

            {/* AI Assistant Response Group - Scroll target for latest turn */}
            <div 
              id={`ai-turn-response-${turn.id || turnIdx}`}
              ref={turnIdx === aiChatTurns.length - 1 ? latestResponseRef : undefined}
              tabIndex={-1}
              className="flex items-start gap-4 scroll-mt-24 focus:outline-none"
            >
              {/* Purple circular AI spark icon */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Sparkles className="w-4 h-4 fill-white text-white" />
              </div>

              {/* Response Body */}
              <div className="flex-1 space-y-4">
                {/* Text summary */}
                <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-normal">
                  {turn.assistantSummary}
                </p>

                {/* Highlight Callout Box with blue left-accent line */}
                {turn.highlightNote && (
                  <div className="bg-[#EEF4FF]/70 border-l-4 border-blue-600 rounded-r-xl rounded-l-xs p-4 flex items-start gap-3">
                    <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                      {turn.highlightNote}
                    </p>
                  </div>
                )}

                {/* Case 1: Products found -> Grid cards */}
                {turn.recommendedProducts && turn.recommendedProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    {turn.recommendedProducts.map((product, idx) => {
                      const isFirst = idx === 0;
                      const badgeText = product.matchBadge || (isFirst ? '98% Match' : '92% Match');
                      const isPurpleBadge = product.matchBadgeColor === 'purple' || (!isFirst && !product.matchBadgeColor);

                      return (
                        <div
                          key={`${turn.id}-${product.id}-${idx}`}
                          onClick={() => handleSelectRecommendedProduct(product, idx + 1)}
                          className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between relative group cursor-pointer"
                        >
                          {/* Top Right Match Badge */}
                          <div 
                            className={`absolute top-0 right-0 px-3.5 py-1 rounded-bl-xl rounded-tr-2xl text-[11px] font-bold flex items-center gap-1 text-white shadow-xs ${
                              isPurpleBadge ? 'bg-purple-600' : 'bg-blue-600'
                            }`}
                          >
                            {isPurpleBadge ? (
                              <SlidersHorizontal className="w-3 h-3" />
                            ) : (
                              <Sparkles className="w-3 h-3 fill-white" />
                            )}
                            <span>{badgeText}</span>
                          </div>

                          {/* Top Details Section */}
                          <div className="flex items-start gap-4 pr-16">
                            {/* Product Square Image */}
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-50 p-2 flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform"
                              />
                            </div>

                            {/* Product Details */}
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-snug group-hover:text-blue-600 transition-colors truncate">
                                {product.name}
                              </h3>

                              <div className="text-blue-600 font-extrabold text-base sm:text-lg">
                                {formatPrice(product.basePrice)}
                              </div>

                              {/* Star Rating & Review Count */}
                              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                <span className="font-bold text-slate-800">{product.rating}</span>
                                <span className="text-slate-400 font-normal">
                                  ({product.ratingCount >= 1000 ? `${(product.ratingCount / 1000).toFixed(1)}k` : product.ratingCount} reviews)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Phase 4: Sales Reasoner & Honest Trade-offs Box */}
                          <div className="mt-4 p-3 bg-slate-50/90 rounded-xl border border-slate-100 text-xs text-slate-700 font-normal leading-relaxed space-y-2">
                            <div>
                              <div className="flex items-center gap-1.5 text-blue-600 font-semibold text-[11px] mb-1">
                                <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>Why this fits you</span>
                              </div>
                              <p className="text-slate-700 text-xs leading-relaxed">
                                {product.whyRecommended || product.matchHighlightQuote || product.matchReason || 'Optimal match for your specifications.'}
                              </p>
                            </div>

                            {product.keyAdvantage && (
                              <div className="text-[11px] text-slate-600 flex items-start gap-1.5 pt-1 border-t border-slate-200/50">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong className="font-semibold text-slate-800">Advantage:</strong> {product.keyAdvantage}</span>
                              </div>
                            )}

                            {product.tradeoff && (
                              <div className="text-[11px] text-amber-800 flex items-start gap-1.5 bg-amber-50/70 p-2 rounded-lg border border-amber-200/50">
                                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong className="font-semibold text-amber-900">Trade-off:</strong> {product.tradeoff}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons Row */}
                          <div className="grid grid-cols-2 gap-3 mt-5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectRecommendedProduct(product, idx + 1);
                              }}
                              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors text-center cursor-pointer"
                            >
                              View Details
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleAddToCart(product, e)}
                              className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors text-center shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Case 2: No matching products empty state */
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                      <PackageSearch className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      No published products match this query in {store?.name || 'this store'}.
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Try searching with different keywords, relaxing price constraints, or exploring our general catalog.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCustomerTab('shop')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                    >
                      <span>Browse All Products</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Phase 5: Trigger Rule - Show Compare action ONLY when 2 or 3 recommendations exist and not already compared */}
                {turn.recommendedProducts.length >= 2 && turn.recommendedProducts.length <= 3 && !turn.comparisonData && (
                  <div className="mt-4 flex justify-start">
                    <button
                      type="button"
                      id={`compare-btn-${turn.id}`}
                      disabled={isAISearchLoading}
                      onClick={() => compareProducts(turn.recommendedProducts.map((p) => p.id))}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>✨ Compare these {turn.recommendedProducts.length} & suggest me the best</span>
                    </button>
                  </div>
                )}

                {/* Phase 5: In-Chat Product Comparison Focus View */}
                {turn.comparisonData && (
                  <div className="mt-5 space-y-4 bg-white border border-indigo-100 rounded-2xl p-5 shadow-xs">
                    {/* Winner Highlight Banner */}
                    {turn.comparisonData.winnerProductId && (
                      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/70 rounded-xl p-4 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                          <Trophy className="w-4 h-4 text-white" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                              Top Recommendation for Your Intent
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900">
                              Winner
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                            {turn.comparisonData.winnerReason}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Compared Products Side-by-Side Grid */}
                    <div className={`grid grid-cols-1 ${turn.comparisonData.products.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 pt-1`}>
                      {turn.comparisonData.products.map((item) => {
                        const isWinner = item.productId === turn.comparisonData?.winnerProductId;
                        const matchingProduct = turn.recommendedProducts.find((p) => p.id === item.productId);

                        return (
                          <div
                            key={item.productId}
                            className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                              isWinner
                                ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-300/50 shadow-xs'
                                : 'bg-slate-50/60 border-slate-200'
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    {isWinner && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white flex items-center gap-1">
                                        <Trophy className="w-3 h-3" /> Best Choice
                                      </span>
                                    )}
                                    {item.brand && (
                                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                        {item.brand}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-1 leading-snug">
                                    {item.name}
                                  </h4>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xs sm:text-sm font-extrabold text-blue-700 block">
                                    {formatPrice(item.price)}
                                  </span>
                                </div>
                              </div>

                              {/* Strengths */}
                              {item.strengths && item.strengths.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                                    Key Strengths
                                  </span>
                                  <ul className="space-y-1">
                                    {item.strengths.map((str, sIdx) => (
                                      <li key={sIdx} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                                        <span>{str}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Weaknesses / Trade-offs */}
                              {item.weaknesses && item.weaknesses.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                                    Trade-offs
                                  </span>
                                  <ul className="space-y-1">
                                    {item.weaknesses.map((weak, wIdx) => (
                                      <li key={wIdx} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                                        <Info className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                                        <span>{weak}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* Actions for this compared item */}
                            {matchingProduct && (
                              <div className="grid grid-cols-2 gap-2 mt-4 pt-2 border-t border-slate-200/60">
                                <button
                                  type="button"
                                  onClick={() => onSelectProduct(matchingProduct)}
                                  className="py-2 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold text-center transition-colors cursor-pointer"
                                >
                                  View Details
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleAddToCart(matchingProduct, e)}
                                  className="py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold text-center transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                >
                                  <ShoppingCart className="w-3 h-3" />
                                  <span>Add to Cart</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Honest Trade-offs Footer */}
                    {turn.comparisonData.tradeoffs && (
                      <div className="pt-3 border-t border-slate-200/80 flex items-start gap-2 text-xs text-slate-600">
                        <Scale className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 mr-1">Honest Trade-off Summary:</span>
                          <span>{turn.comparisonData.tradeoffs}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Phase 6: Complete Your Setup & Intelligent Bundling Card */}
                {(turn.bundleOpportunity || (turn.crossSell?.suggestions && turn.crossSell.suggestions.length > 0)) && (
                  <div className="mt-4 p-5 bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50/80 border border-blue-200/80 rounded-2xl shadow-xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-blue-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span>Complete your setup</span>
                            {turn.bundleOpportunity?.discountEligible && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-2xs">
                                <Tag className="w-2.5 h-2.5" /> Save ₹{turn.bundleOpportunity.savings.toLocaleString('en-IN')} (10% off)
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-600">
                            {turn.bundleOpportunity?.bundleSummary || 'Carefully chosen complementary accessories to get the most out of your purchase.'}
                          </p>
                        </div>
                      </div>

                      {turn.bundleOpportunity && (
                        <div className="text-right">
                          <div className="flex items-baseline gap-1.5 justify-end">
                            {turn.bundleOpportunity.discountEligible && (
                              <span className="text-[11px] text-slate-400 line-through">
                                {formatPrice(turn.bundleOpportunity.originalTotal)}
                              </span>
                            )}
                            <span className="text-sm sm:text-base font-extrabold text-blue-700">
                              {formatPrice(turn.bundleOpportunity.bundlePrice)}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {turn.bundleOpportunity.products.length} items bundle
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Complementary Suggestions List */}
                    {turn.crossSell?.suggestions && turn.crossSell.suggestions.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {turn.crossSell.suggestions.map((suggestion) => {
                          const catalogProduct = products.find((p) => p.id === suggestion.productId);
                          const isAlreadyInCart = (serverCart?.items || []).some(
                            (i) => i.productId === suggestion.productId
                          );

                          return (
                            <div
                              key={suggestion.productId}
                              className="bg-white p-3 rounded-xl border border-slate-200/90 flex flex-col justify-between hover:border-blue-300 transition-all shadow-2xs"
                            >
                              <div className="space-y-2">
                                <div className="h-24 w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                                  {suggestion.image ? (
                                    <img
                                      src={suggestion.image}
                                      alt={suggestion.name}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <PackagePlus className="w-8 h-8 text-slate-400" />
                                  )}
                                </div>
                                <div>
                                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                                    {suggestion.category}
                                  </span>
                                  <h5 className="text-xs font-bold text-slate-900 line-clamp-1">
                                    {suggestion.name}
                                  </h5>
                                  <span className="text-xs font-extrabold text-blue-700 block mt-0.5">
                                    {formatPrice(suggestion.price)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-600 line-clamp-2 leading-tight">
                                  {suggestion.reason}
                                </p>
                              </div>

                              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                                {catalogProduct && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectProduct(catalogProduct)}
                                    className="flex-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-lg text-center transition-colors cursor-pointer"
                                  >
                                    View
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isAlreadyInCart}
                                  onClick={(e) => {
                                    const productToAdd: Product = catalogProduct || {
                                      id: suggestion.productId,
                                      name: suggestion.name,
                                      category: suggestion.category,
                                      brand: suggestion.brand,
                                      basePrice: suggestion.price,
                                      minPrice: suggestion.price,
                                      maxPrice: suggestion.price,
                                      stock: suggestion.stock,
                                      rating: 4.8,
                                      reviewCount: 15,
                                      images: suggestion.image ? [suggestion.image] : [],
                                      features: [],
                                      specifications: {},
                                      tags: [],
                                    };
                                    handleAddToCart(productToAdd, e);
                                  }}
                                  className={`flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                                    isAlreadyInCart
                                      ? 'bg-slate-100 text-slate-500 cursor-default'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                                  }`}
                                >
                                  {isAlreadyInCart ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>In Cart</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShoppingCart className="w-3 h-3" />
                                      <span>Add</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Full Bundle Button */}
                    {turn.bundleOpportunity && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!turn.bundleOpportunity) return;
                            for (const bProd of turn.bundleOpportunity.products) {
                              const alreadyInCart = (serverCart?.items || []).some((i) => i.productId === bProd.id);
                              if (!alreadyInCart) {
                                const catalogP = products.find((p) => p.id === bProd.id);
                                const pToAdd: Product = catalogP || {
                                  id: bProd.id,
                                  name: bProd.name,
                                  category: bProd.category,
                                  brand: bProd.brand || '',
                                  basePrice: bProd.price,
                                  minPrice: bProd.price,
                                  maxPrice: bProd.price,
                                  stock: bProd.stock,
                                  rating: 4.8,
                                  reviewCount: 20,
                                  images: bProd.image ? [bProd.image] : [],
                                  features: [],
                                  specifications: {},
                                  tags: [],
                                };
                                addToCart(pToAdd, 1);
                              }
                            }
                            setToastMessage(`Setup items added to your cart!`);
                            setTimeout(() => setToastMessage(null), 2500);
                          }}
                          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <PackagePlus className="w-4 h-4" />
                          <span>Add Entire Setup to Cart</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Commercial Intervention / Offer Card */}
                {turn.commercialOffer && turn.commercialOffer.type !== 'NO_OFFER' && (
                  <CommercialOfferCard
                    offer={turn.commercialOffer}
                    onOpenCart={onOpenCart}
                  />
                )}
              </div>
            </div>

          </div>
        ))}

        {/* Active AI Searching / Loading State Bubble */}
        {isAISearchLoading && (
          <div ref={loadingRef} className="flex items-start gap-4 animate-pulse scroll-mt-24">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>OptiCommerce AI is searching & ranking recommendations...</span>
              </div>
              <p className="text-xs text-slate-500">
                Analyzing your intent, searching store catalog, and computing relevance scores.
              </p>
            </div>
          </div>
        )}

        {/* AI Search Error Banner */}
        {aiSearchError && !isAISearchLoading && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3 text-red-800 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{aiSearchError}</span>
            </div>
            <button
              onClick={() => {
                if (latestTurn?.userPrompt) {
                  askAIAssistant(latestTurn.userPrompt);
                }
              }}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>

      {/* Floating Prompt Bar at the Bottom */}
      <div className="sticky bottom-0 z-30 w-full pt-4 pb-4 bg-gradient-to-t from-white via-white/95 to-transparent backdrop-blur-xs mt-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-3">
          
          {/* Text Input Pill Box */}
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isAISearchLoading}
              placeholder="Ask for anything, e.g. wireless headphones under ₹5,000 with strong bass"
              className="w-full pl-6 pr-14 py-3.5 bg-white border border-slate-200/90 rounded-full text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-md transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isAISearchLoading}
              className="absolute right-2 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer"
              aria-label="Send AI Prompt"
            >
              {isAISearchLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4 fill-white" />
              )}
            </button>
          </form>

          {/* Follow-up Quick Suggestion Chips */}
          <div className="flex flex-wrap items-center gap-2.5 px-2">
            {(latestTurn?.suggestedFollowUps || [
              'Wireless headphones under ₹5,000 with strong bass',
              'Show me ultraportable laptops for work',
              'Silent wireless mouse under ₹2,000'
            ]).map((chip, idx) => (
              <button
                key={idx}
                disabled={isAISearchLoading}
                onClick={() => handleChipClick(chip)}
                className="px-4 py-2 bg-[#EEF4FF]/90 hover:bg-blue-100 text-blue-900 rounded-full text-xs font-semibold border border-blue-200/60 shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

