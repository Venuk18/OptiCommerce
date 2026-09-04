import React from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { Package, Sparkles, CheckCircle2, Clock } from 'lucide-react';

export function OrdersView() {
  const { orders, formatINR, setCustomerTab } = useCommerce();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Your Order History</h1>
        <p className="text-xs text-slate-500 mt-1">Track current shipments and review previous AI-optimized purchases.</p>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <Package className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No orders placed yet.</p>
            <button
              onClick={() => setCustomerTab('storefront')}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold">Order ID: </span>
                  <span className="font-mono font-bold text-slate-900">{order.id}</span>
                  <span className="text-slate-400 ml-3">Placed on {order.date}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-bold w-fit">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{order.status}</span>
                </div>
              </div>

              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between text-xs py-1">
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
                    <span className="font-bold text-slate-900">
                      {formatINR(item.product.basePrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">Delivering to: {order.shippingAddress}</span>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] font-semibold">Total Paid</span>
                  <span className="text-sm font-extrabold text-blue-600">{formatINR(order.total)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
