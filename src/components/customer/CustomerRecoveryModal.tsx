import React from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { Sparkles, X, ArrowRight, ShieldCheck, Tag } from 'lucide-react';

interface CustomerRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyRecoveryDeal: () => void;
}

export function CustomerRecoveryModal({ isOpen, onClose, onApplyRecoveryDeal }: CustomerRecoveryModalProps) {
  const { constraints, formatINR, products } = useCommerce();

  if (!isOpen || !constraints.exitIntentIncentives) return null;

  // Recovery product within budget / constraints
  const recoveryProduct = products[1]; // SonicBuds Elite (₹3,299)

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-fadeIn space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2 text-center">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="inline-block px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
            AI Smart Exit-Intent Deal
          </span>
          <h3 className="text-lg font-extrabold text-slate-900">Wait! Don't leave empty-handed</h3>
          <p className="text-xs text-slate-500">
            Our AI optimizer created an exclusive personalized offer for your session.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex items-center gap-4">
          <img
            src={recoveryProduct.image}
            alt={recoveryProduct.name}
            className="w-16 h-16 object-cover rounded-xl border border-slate-200 bg-white"
          />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-900">{recoveryProduct.name}</h4>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900">{formatINR(recoveryProduct.basePrice * 0.95)}</span>
              <span className="text-xs text-slate-400 line-through">{formatINR(recoveryProduct.basePrice)}</span>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded-md inline-block">
              5% AI Instant Nudge Applied
            </span>
          </div>
        </div>

        <button
          onClick={onApplyRecoveryDeal}
          className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
        >
          <span>Claim 5% Off & Add to Cart</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
