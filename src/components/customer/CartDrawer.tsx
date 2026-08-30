import React from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight
} from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToCheckout: () => void;
}

export function CartDrawer({ isOpen, onClose, onProceedToCheckout }: CartDrawerProps) {
  const { 
    cart, 
    updateCartQuantity, 
    removeFromCart, 
    cartSubtotal, 
    cartSavings, 
    cartTotal, 
    formatINR, 
    constraints 
  } = useCommerce();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Your Shopping Cart</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-slate-800">Your cart is currently empty</p>
                <p className="text-xs text-slate-400">Discover AI-recommended products in the store.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3"
                >
                  <div className="flex gap-3">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded-xl border border-slate-200 bg-white"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.product.name}</h4>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {formatINR(item.product.basePrice)}
                      </p>

                      {/* AI Dynamic Discount Badge */}
                      {item.appliedDiscountPercent > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md font-bold w-fit">
                          <Sparkles className="w-3 h-3" />
                          <span>{item.discountReason || `${item.appliedDiscountPercent}% AI Discount`}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-900 w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-xs font-extrabold text-slate-900">
                      {formatINR(
                        item.product.basePrice * item.quantity * (1 - item.appliedDiscountPercent / 100)
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Summary */}
          {cart.length > 0 && (
            <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold">{formatINR(cartSubtotal)}</span>
                </div>

                {cartSavings > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Dynamic Discount
                    </span>
                    <span>-{formatINR(cartSavings)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-900 font-extrabold text-base pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span>{formatINR(cartTotal)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>AI Margin-protected transaction</span>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onProceedToCheckout();
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
