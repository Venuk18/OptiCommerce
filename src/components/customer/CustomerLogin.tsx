import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useCommerce } from '../../context/CommerceContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';

interface CustomerLoginProps {
  storeSlug?: string;
  onNavigate?: (path: string) => void;
}

export function CustomerLogin({ storeSlug, onNavigate }: CustomerLoginProps) {
  const { store, mergeCustomerCart } = useCommerce();
  const { customer, isAuthenticated, login, register, logout } = useCustomerAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const effectiveSlug = storeSlug || store?.slug || 'opticommerce-flagship-electronics';
  const storeDisplayName = store?.name || 'OptiCommerce Storefront';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetStoreId = store?.id;
    if (!targetStoreId) {
      setErrorMessage('Store is currently loading. Please try again in a moment.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password, targetStoreId);
        setSuccessMessage('Signed in successfully! Updating your cart...');
      } else {
        await register(email, password, targetStoreId, name ? name.trim() : undefined);
        setSuccessMessage('Account created successfully! Updating your cart...');
      }

      // Merge active guest cart into authenticated customer cart
      try {
        await mergeCustomerCart(targetStoreId);
      } catch (mergeErr) {
        console.warn('[CustomerLogin] Cart merge notice:', mergeErr);
        // Do not block authentication if merge encounters a minor issue
      }

      // Navigate back to storefront
      handleBackToStore();
    } catch (err: any) {
      console.error('[CustomerLogin] Auth error:', err);
      const msg = err?.message || (mode === 'login' ? 'Invalid email or password.' : 'Failed to create account.');
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToStore = () => {
    if (onNavigate) {
      onNavigate(`/store/${effectiveSlug}`);
    } else {
      window.history.pushState({}, '', `/store/${effectiveSlug}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 bg-slate-50/50">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden animate-fadeIn">
        {/* Top Header */}
        <div className="bg-gradient-to-b from-blue-600 to-blue-700 px-8 py-8 text-white text-center relative">
          <div className="w-12 h-12 bg-white/15 backdrop-blur-xs border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <User className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Customer Account</h2>
          <p className="text-xs text-blue-100 mt-1 font-medium">
            {storeDisplayName}
          </p>
          <span className="inline-flex items-center gap-1 mt-2.5 px-2.5 py-0.5 bg-blue-800/60 rounded-full text-[10px] font-semibold text-blue-200 border border-blue-400/20">
            <Sparkles className="w-3 h-3 text-amber-300" />
            Public Storefront Customer Experience
          </span>
        </div>

        {/* If already authenticated, show account status and navigation */}
        {isAuthenticated && customer ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Signed In Successfully</h3>
              <p className="text-xs text-slate-500 mt-1">
                Active account: <strong className="text-slate-800">{customer.email}</strong>
              </p>
            </div>
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={handleBackToStore}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Return to Storefront</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <>
        {/* Tab Toggle */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-3.5 transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-3.5 transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Guest Shopping Banner */}
        <div className="m-6 mb-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold">Guest Shopping is Active:</span> You can browse the catalog, use the AI shopping assistant, and checkout anytime without creating an account.
          </div>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="mx-6 mt-2 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-900 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed font-medium">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Success Notice */}
        {successMessage && (
          <div className="mx-6 mt-2 p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900 animate-fadeIn">
            <Loader2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-spin" />
            <div className="text-[11px] leading-relaxed font-medium">
              {successMessage}
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Your Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  disabled={isSubmitting}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rahul Verma"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                disabled={isSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{mode === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Back to store navigation */}
        <div className="px-6 pb-6 pt-2 text-center border-t border-slate-100 flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleBackToStore}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Continue Browsing as Guest</span>
          </button>
          <p className="text-[10px] text-slate-400">
            Protected by anonymous guest session isolation. Zero customer PII required.
          </p>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

