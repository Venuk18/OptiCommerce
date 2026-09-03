import React from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { Store, ShieldCheck, ArrowRight } from 'lucide-react';

export function ExperienceSwitcher() {
  const { experience, setExperience, setMerchantTab, setCustomerTab } = useCommerce();

  return (
    <div className="fixed bottom-4 right-6 z-50 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700/60 text-xs transition-all hover:border-blue-500/50">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-semibold tracking-wide text-slate-300">OptiCommerce Live System</span>
      </div>

      <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-full">
        <button
          onClick={() => {
            setExperience('merchant');
            setMerchantTab('dashboard');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors ${
            experience === 'merchant'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Merchant Suite
        </button>

        <button
          onClick={() => {
            setExperience('customer');
            setCustomerTab('home');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors ${
            experience === 'customer'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          Customer Storefront
        </button>
      </div>

      <button
        onClick={() => {
          if (experience === 'merchant') {
            setExperience('customer');
            setCustomerTab('home');
          } else {
            setExperience('merchant');
            setMerchantTab('dashboard');
          }
        }}
        className="flex items-center gap-1 pl-2 text-slate-300 hover:text-blue-400 font-medium transition-colors"
        title="Quick Toggle View"
      >
        <span>Switch</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
