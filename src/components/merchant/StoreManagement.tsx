import React from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { Store, Globe, Key, Shield, CheckCircle2 } from 'lucide-react';

export function StoreManagement() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Store Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Store profile details, regional currency configuration, and security settings.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            OC
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">OptiCommerce Flagship Electronics</h2>
            <p className="text-xs text-slate-500">Merchant Store ID: <span className="font-mono font-bold text-slate-700">STORE-IN-9821</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <label className="font-bold text-slate-700">Store Public Name</label>
            <input
              type="text"
              defaultValue="OptiCommerce Store"
              className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700">Operating Currency</label>
            <input
              type="text"
              disabled
              defaultValue="INR (₹) - Indian Rupee"
              className="w-full mt-1.5 p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-semibold cursor-not-allowed"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700">Support Email</label>
            <input
              type="email"
              defaultValue="support@opticorner.io"
              className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700">Store Domain</label>
            <input
              type="text"
              defaultValue="store.opticorner.io"
              className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer">
            Save Store Details
          </button>
        </div>
      </div>
    </div>
  );
}
