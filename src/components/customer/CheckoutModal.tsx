import React, { useState } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { 
  X, 
  CreditCard, 
  ShieldCheck, 
  Sparkles, 
  MapPin, 
  User, 
  Mail,
  Lock
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { 
    cart, 
    cartSubtotal, 
    cartSavings, 
    cartTotal, 
    formatINR, 
    checkoutOrder,
    isCheckingOut,
    checkoutError 
  } = useCommerce();

  const [form, setForm] = useState({
    name: 'Rahul Verma',
    email: 'rahul.verma@example.com',
    address: 'Flat 402, Green Glen Heights, Bellandur, Bangalore 560103',
  });

  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await checkoutOrder(form);
      onClose();
    } catch (err: any) {
      setLocalError(err?.message || 'Checkout failed. Please check your cart and try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Secure AI-Optimized Checkout</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4 text-xs">
          {/* Shipping Address */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Shipping Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700">Delivery Address</label>
              <textarea
                rows={2}
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Payment Method Preview */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              <span>Payment Gateway (Razorpay)</span>
            </h3>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  RZP
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">Razorpay Secure Checkout</p>
                  <p className="text-[11px] text-slate-500">UPI, NetBanking, Cards & Wallets</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                100% Secure
              </span>
            </div>
          </div>

          {/* Order Total Breakdown */}
          <div className="p-4 bg-slate-100 rounded-2xl space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Items Total ({cart.length})</span>
              <span className="font-semibold">{formatINR(cartSubtotal)}</span>
            </div>
            {cartSavings > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>AI Applied Savings</span>
                <span>-{formatINR(cartSavings)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-2 border-t border-slate-200">
              <span>Final Payable Amount</span>
              <span className="text-base text-blue-600">{formatINR(cartTotal)}</span>
            </div>
          </div>

          {/* Error Message */}
          {(localError || checkoutError) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
              {localError || checkoutError}
            </div>
          )}

          <button
            type="submit"
            disabled={isCheckingOut || cart.length === 0}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
          >
            {isCheckingOut ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating Persistent Order...</span>
              </span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Complete Order ({formatINR(cartTotal)})</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
