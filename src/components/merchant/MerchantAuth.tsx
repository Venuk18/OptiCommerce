import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  User, 
  Store, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Target, 
  Brain, 
  TrendingUp, 
  BarChart3, 
  Layers, 
  CheckCircle2 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface MerchantAuthProps {
  initialMode?: 'login' | 'register';
  onNavigate?: (to: string) => void;
}

export function MerchantAuth({ initialMode = 'login', onNavigate }: MerchantAuthProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [storeName, setStoreName] = useState('');

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim());
  };

  const handleModeSwitch = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError(null);
    if (onNavigate) {
      onNavigate(newMode === 'register' ? '/merchant/register' : '/merchant/login');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Form validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError('Full name is required');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password, storeName.trim() || undefined);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 selection:bg-blue-100 selection:text-blue-900 animate-fadeIn">
      {/* Top Brand Nav */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6">
        <div 
          onClick={() => onNavigate ? onNavigate('/merchant') : undefined}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-slate-900 text-lg tracking-tight block">
              OptiCommerce
            </span>
            <span className="text-[11px] text-blue-600 font-bold uppercase tracking-wider block -mt-0.5">
              Merchant Intelligence Platform
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleModeSwitch(mode === 'login' ? 'register' : 'login')}
          className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-white border border-transparent hover:border-slate-200"
        >
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </header>

      {/* Main Authentication Container */}
      <main className="max-w-4xl w-full mx-auto my-auto py-4">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left / Main Form Column */}
          <div className="p-8 sm:p-10 lg:col-span-7 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="mb-6">
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/60 inline-flex items-center gap-1.5 mb-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Merchant Authentication</span>
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {mode === 'login' ? 'Welcome back' : 'Create Merchant Account'}
                </h1>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {mode === 'login'
                    ? 'Sign in to manage your storefront, products, and revenue intelligence.'
                    : 'Launch your store catalog and start converting intent into revenue.'}
                </p>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('register')}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3.5 mb-5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Merchant Full Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Sarah Jenkins"
                          required={mode === 'register'}
                          disabled={isSubmitting}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Store Name (Optional)</label>
                      <div className="relative">
                        <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          placeholder="e.g. Apex Electronics Studio"
                          disabled={isSubmitting}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="merchant@example.com"
                      required
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="•••••••• (Min 8 characters)"
                      required
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required={mode === 'register'}
                        disabled={isSubmitting}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                        title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating session...</span>
                    </>
                  ) : mode === 'login' ? (
                    <>
                      <span>Sign In to Merchant Suite</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Create Merchant Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom Form Switcher Link */}
            <div className="pt-6 mt-6 border-t border-slate-100 text-center">
              {mode === 'login' ? (
                <p className="text-xs text-slate-500">
                  New to OptiCommerce?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('register')}
                    className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer ml-1 underline underline-offset-2"
                  >
                    Create Merchant Account
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('login')}
                    className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer ml-1 underline underline-offset-2"
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Value Panel (Desktop only, hidden on mobile/tablet) */}
          <div className="hidden lg:flex lg:col-span-5 bg-slate-900 text-white p-8 flex-col justify-between border-l border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-900/60 border border-blue-700/50 rounded-full text-blue-300 text-[10px] font-bold mb-5">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Revenue Engine Architecture</span>
              </div>

              <h2 className="text-lg font-black tracking-tight mb-2">
                Turn customer intent into revenue.
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Connect customer-facing conversation with autonomous sales reasoning and margin control.
              </p>

              {/* Value Cascade */}
              <div className="space-y-2 bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                {[
                  { label: 'Customer Intent', icon: <Target className="w-3.5 h-3.5 text-blue-400" /> },
                  { label: 'AI Recommendations', icon: <Brain className="w-3.5 h-3.5 text-indigo-400" /> },
                  { label: 'Better Decisions', icon: <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> },
                  { label: 'Higher Conversion', icon: <BarChart3 className="w-3.5 h-3.5 text-emerald-400" /> },
                  { label: 'Merchant Revenue', icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> },
                ].map((node, idx) => (
                  <React.Fragment key={idx}>
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-200">
                      <div className="w-6 h-6 rounded-lg bg-slate-800/80 flex items-center justify-center shrink-0">
                        {node.icon}
                      </div>
                      <span>{node.label}</span>
                    </div>
                    {idx < 4 && (
                      <div className="pl-3 text-slate-600 text-[10px] leading-none">
                        ↓
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Three Capabilities Badges */}
            <div className="pt-6 border-t border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <Brain className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>AI Recommendations</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Smart Bundling</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Revenue Intelligence</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer info note */}
      <footer className="max-w-4xl w-full mx-auto text-center pt-6 text-[11px] text-slate-400">
        <p>Protected by stateless JWT merchant session authentication.</p>
      </footer>
    </div>
  );
}
