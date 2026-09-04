import React from 'react';
import { Zap } from 'lucide-react';

export function CustomerFooter() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-20 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-100">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xs">
                <Zap className="w-4 h-4 fill-white" />
              </div>
              <span className="font-bold text-slate-900 text-base">OptiCommerce</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Next-generation commerce platform powered by intelligent revenue optimization engines.
            </p>
          </div>

          {/* Explore */}
          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Explore</h4>
            <ul className="space-y-2 text-slate-500 font-medium">
              <li><a href="#new" className="hover:text-blue-600 transition-colors">New Arrivals</a></li>
              <li><a href="#bestsellers" className="hover:text-blue-600 transition-colors">Best Sellers</a></li>
              <li><a href="#aipicks" className="hover:text-blue-600 transition-colors">AI Picks</a></li>
            </ul>
          </div>

          {/* Account */}
          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Account</h4>
            <ul className="space-y-2 text-slate-500 font-medium">
              <li><a href="#profile" className="hover:text-blue-600 transition-colors">My Profile</a></li>
              <li><a href="#orders" className="hover:text-blue-600 transition-colors">Order Tracking</a></li>
              <li><a href="#wishlist" className="hover:text-blue-600 transition-colors">Wishlist</a></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Support</h4>
            <ul className="space-y-2 text-slate-500 font-medium">
              <li><a href="#help" className="hover:text-blue-600 transition-colors">Help Center</a></li>
              <li><a href="#concierge" className="hover:text-blue-600 transition-colors">Contact AI Concierge</a></li>
              <li><a href="#returns" className="hover:text-blue-600 transition-colors">Returns</a></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 OptiCommerce. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-slate-600">Privacy Policy</a>
            <a href="#terms" className="hover:text-slate-600">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
