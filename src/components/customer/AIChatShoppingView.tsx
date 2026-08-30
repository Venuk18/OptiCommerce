import React, { useState, useRef, useEffect } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { Product } from '../../types';
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
  Bot
} from 'lucide-react';

interface AIChatShoppingViewProps {
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
}

export function AIChatShoppingView({ onSelectProduct, onOpenCart }: AIChatShoppingViewProps) {
  const { 
    aiChatTurns, 
    askAIAssistant, 
    addToCart, 
    formatPrice,
    setCustomerTab,
    setManualSearchQuery
  } = useCommerce();

  const [inputPrompt, setInputPrompt] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new chat turns
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChatTurns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim()) return;
    askAIAssistant(inputPrompt.trim());
    setInputPrompt('');
  };

  const handleChipClick = (chipText: string) => {
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
        
        {/* Render each turn in the AI conversation */}
        {aiChatTurns.map((turn, turnIdx) => (
          <div key={turn.id || turnIdx} className="space-y-6 animate-fadeIn">
            
            {/* User Message Bubble (Right aligned with soft blue/lavender tint) */}
            <div className="flex justify-end">
              <div className="bg-[#EEF4FF] text-slate-900 text-sm sm:text-base font-normal px-6 py-4 rounded-2xl max-w-xl shadow-xs border border-blue-100/80 leading-relaxed">
                {turn.userPrompt}
              </div>
            </div>

            {/* AI Assistant Response Group */}
            <div className="flex items-start gap-4">
              {/* Purple circular AI spark icon */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Sparkles className="w-4 h-4 fill-white text-white" />
              </div>

              {/* Response Body */}
              <div className="flex-1 space-y-4">
                {/* Text summary */}
                <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-normal">
                  {turn.assistantSummary.includes('4 products') ? (
                    <>
                      I found <strong className="text-blue-600 font-bold">4 products</strong> that match your requirements: '{turn.userPrompt.replace(/Can you find me (some )?/i, '').replace(/\?$/, '')}'.
                    </>
                  ) : (
                    turn.assistantSummary
                  )}
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

                {/* Recommended Product Comparison Cards (Grid matching screenshot) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                  {turn.recommendedProducts.map((product, idx) => {
                    const isFirst = idx === 0;
                    const badgeText = product.matchBadge || (isFirst ? '98% Match' : '92% Match');
                    const isPurpleBadge = product.matchBadgeColor === 'purple' || (!isFirst && !product.matchBadgeColor);

                    return (
                      <div
                        key={`${turn.id}-${product.id}-${idx}`}
                        onClick={() => onSelectProduct(product)}
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

                        {/* Quote Highlight Box matching screen */}
                        <div className="mt-4 p-3 bg-slate-50/90 rounded-xl border border-slate-100 flex items-start gap-2.5 text-xs text-slate-700 font-normal leading-relaxed">
                          {product.matchHighlightType === 'info' || isPurpleBadge ? (
                            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          )}
                          <span>"{product.matchHighlightQuote || product.matchReason || 'Optimal match for your specifications.'}"</span>
                        </div>

                        {/* Action Buttons Row */}
                        <div className="grid grid-cols-2 gap-3 mt-5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProduct(product);
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
              </div>
            </div>

          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Floating Prompt Bar at the Bottom (Exact match with screen.png) */}
      <div className="sticky bottom-0 z-30 w-full pt-4 pb-4 bg-gradient-to-t from-white via-white/95 to-transparent backdrop-blur-xs mt-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-3">
          
          {/* Text Input Pill Box */}
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="I like the ZenPods, but are there any in white?"
              className="w-full pl-6 pr-14 py-3.5 bg-white border border-slate-200/90 rounded-full text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-md transition-all"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim()}
              className="absolute right-2 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer"
              aria-label="Send AI Prompt"
            >
              <Send className="w-4 h-4 fill-white" />
            </button>
          </form>

          {/* Follow-up Quick Suggestion Chips */}
          <div className="flex flex-wrap items-center gap-2.5 px-2">
            {(latestTurn?.suggestedFollowUps || [
              'Show me something with better battery life',
              'Are there any Sony options?',
              'I like the ZenPods, but are there any in white?'
            ]).map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(chip)}
                className="px-4 py-2 bg-[#EEF4FF]/90 hover:bg-blue-100 text-blue-900 rounded-full text-xs font-semibold border border-blue-200/60 shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
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
