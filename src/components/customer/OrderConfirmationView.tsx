import React from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { 
  CheckCircle2, 
  Sparkles, 
  Package, 
  ArrowRight, 
  ShieldCheck,
  ShoppingBag
} from 'lucide-react';

export function OrderConfirmationView() {
  const { lastCompletedOrder, setCustomerTab, formatINR } = useCommerce();

  if (!lastCompletedOrder) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <p className="text-slate-500 text-sm font-semibold">No recent order found.</p>
        <button
          onClick={() => setCustomerTab('storefront')}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
        >
          Return to Storefront
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8 animate-fadeIn">
      {/* Success Badge */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Order Confirmed!</h1>
        <p className="text-xs text-slate-500">
          Order ID: <span className="font-mono font-bold text-slate-900">{lastCompletedOrder.id}</span>
        </p>
      </div>

      {/* Details Box */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs">
          <div>
            <p className="text-slate-400 font-semibold">Delivery Estimate</p>
            <p className="font-bold text-slate-900 mt-0.5">2-3 Business Days</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 font-semibold">Customer</p>
            <p className="font-bold text-slate-900 mt-0.5">{lastCompletedOrder.customerName}</p>
          </div>
        </div>

        {/* Purchased Items */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Ordered Items</h3>
          {lastCompletedOrder.items.map((item) => (
            <div key={item.product.id} className="flex items-center justify-between text-xs py-2 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="w-10 h-10 object-cover rounded-lg border border-slate-100"
                />
                <div>
                  <p className="font-bold text-slate-900">{item.product.name}</p>
                  <p className="text-slate-400 text-[11px]">Qty: {item.quantity}</p>
                </div>
              </div>
              <p className="font-bold text-slate-900">{formatINR(item.product.basePrice * item.quantity)}</p>
            </div>
          ))}
        </div>

        {/* AI Savings Highlight */}
        {lastCompletedOrder.aiSavings > 0 && (
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-purple-900">OptiCommerce AI Savings Applied</span>
            </div>
            <span className="text-xs font-extrabold text-purple-900">-{formatINR(lastCompletedOrder.aiSavings)}</span>
          </div>
        )}

        <div className="pt-2 flex justify-between text-sm font-extrabold text-slate-900 border-t border-slate-100">
          <span>Total Paid</span>
          <span className="text-blue-600">{formatINR(lastCompletedOrder.total)}</span>
        </div>

        <button
          onClick={() => setCustomerTab('storefront')}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Continue Shopping</span>
        </button>
      </div>
    </div>
  );
}
