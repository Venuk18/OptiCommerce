import React, { useState, useEffect } from 'react';
import { useCommerce } from '../../context/CommerceContext';
import { storeService } from '../../services/store.service';
import { merchantService } from '../../services/merchant.service';
import { 
  Store as StoreIcon, 
  Globe, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Copy, 
  Check, 
  Radio, 
  EyeOff, 
  Eye, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { Store, StoreStatus } from '../../types';

export function StoreManagement() {
  const { 
    store, 
    merchant, 
    isStoreLoading, 
    storeError: contextStoreError, 
    refreshStore, 
    setStore,
    setExperience,
    setCustomerTab
  } = useCommerce();

  // Local Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  
  // Interaction states
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Sync form state with context store data
  useEffect(() => {
    if (store) {
      setName(store.name || '');
      setSlug(store.slug || '');
      setDescription(store.description || '');
      setErrorMessage(null);
    }
  }, [store]);

  const isFormDirty = Boolean(
    store && (
      name !== (store.name || '') ||
      slug !== (store.slug || '') ||
      description !== (store.description || '')
    )
  );

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!store) return;

    // Validation
    if (!name.trim()) {
      setErrorMessage('Store name cannot be empty');
      return;
    }
    if (!slug.trim()) {
      setErrorMessage('Store slug cannot be empty');
      return;
    }

    const cleanSlug = slug.trim().toLowerCase();
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(cleanSlug)) {
      setErrorMessage('Slug must contain only lowercase letters, numbers, and hyphens (e.g. my-store-name)');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedStore = await storeService.updateStore(store.id, {
        name: name.trim(),
        slug: cleanSlug,
        description: description.trim() || null,
      });

      setStore(updatedStore);
      setSuccessMessage('Store profile and details updated successfully!');
      
      // Clear success feedback after 4 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update store details. Please check your inputs.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: StoreStatus) => {
    if (!store) return;

    setIsUpdatingStatus(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedStore = await storeService.updateStoreStatus(store.id, newStatus);
      setStore(updatedStore);
      
      if (newStatus === 'PUBLISHED') {
        setSuccessMessage('Store published live! Customers can now access your storefront.');
      } else {
        setSuccessMessage('Store unpublished. Your store is now in draft mode.');
      }

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update store publishing status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleResetForm = () => {
    if (store) {
      setName(store.name || '');
      setSlug(store.slug || '');
      setDescription(store.description || '');
      setErrorMessage(null);
    }
  };

  const storeInitials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'OC';

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Store Management</span>
            {store?.status === 'PUBLISHED' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Draft
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure real-time store profile, publishing visibility, domain slugs, and merchant ownership.
          </p>
        </div>

        {/* Refresh Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshStore(slug || undefined)}
            disabled={isStoreLoading || isSaving}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Reload from backend API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isStoreLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>{isStoreLoading ? 'Syncing...' : 'Sync with API'}</span>
          </button>
        </div>
      </div>

      {/* API Feedback Alerts */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-start justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-900">API Error</p>
              <p className="mt-0.5 text-red-700 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
          <button 
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-800 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-start justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-900">Update Successful</p>
              <p className="mt-0.5 text-emerald-700 leading-relaxed">{successMessage}</p>
            </div>
          </div>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-800 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Store Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Store Identifier Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              {isStoreLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : storeInitials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {isStoreLoading ? (
                  <span className="inline-block w-48 h-6 bg-slate-200 rounded animate-pulse" />
                ) : (
                  store?.name || 'OptiCommerce Store'
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                <span>Store ID:</span>
                {isStoreLoading ? (
                  <span className="inline-block w-32 h-4 bg-slate-100 rounded animate-pulse" />
                ) : (
                  <button
                    onClick={() => store?.id && handleCopy(store.id, 'storeId')}
                    className="font-mono font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1 cursor-pointer bg-slate-100 px-2 py-0.5 rounded transition-colors"
                    title="Click to copy Store UUID"
                  >
                    <span>{store?.id ? `${store.id.slice(0, 18)}...` : 'STORE-IN-9821'}</span>
                    {copiedField === 'storeId' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Store Status Toggle */}
          <div className="flex items-center gap-3">
            {store?.status === 'PUBLISHED' ? (
              <button
                type="button"
                onClick={() => handleStatusChange('UNPUBLISHED')}
                disabled={isUpdatingStatus || isStoreLoading}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isUpdatingStatus ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>Unpublish Store</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleStatusChange('PUBLISHED')}
                disabled={isUpdatingStatus || isStoreLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isUpdatingStatus ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>Publish Store Live</span>
              </button>
            )}
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSaveDetails} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            {/* Store Public Name */}
            <div>
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span>Store Public Name</span>
                <span className="text-[10px] font-normal text-slate-400">Required</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. OptiCommerce Flagship Electronics"
                disabled={isStoreLoading || isSaving}
                className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-900 disabled:opacity-60"
              />
            </div>

            {/* Operating Currency */}
            <div>
              <label className="font-bold text-slate-700">Operating Currency</label>
              <input
                type="text"
                disabled
                defaultValue="INR (₹) - Indian Rupee"
                className="w-full mt-1.5 p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-semibold cursor-not-allowed"
              />
            </div>

            {/* Store Slug / Domain */}
            <div>
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span>Store Slug (URL Identifier)</span>
                <span className="text-[10px] font-normal text-slate-400">Unique URL path</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="e.g. opticommerce-flagship-electronics"
                  disabled={isStoreLoading || isSaving}
                  className="w-full p-3 font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 disabled:opacity-60"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Store URL: <span className="font-mono text-slate-600 font-semibold">https://opticommerce.io/store/{slug || 'your-slug'}</span>
              </p>
            </div>

            {/* Support / Merchant Email */}
            <div>
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span>Merchant Support Email</span>
                <span className="text-[10px] font-normal text-slate-400">Account Contact</span>
              </label>
              <input
                type="email"
                disabled
                value={merchant?.email || 'merchant@opticommerce.io'}
                className="w-full mt-1.5 p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-medium cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Merchant Owner: <span className="font-semibold text-slate-600">{merchant?.name || 'OptiCommerce Flagship Merchant'}</span>
              </p>
            </div>

            {/* Store Description */}
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span>Store Description</span>
                <span className="text-[10px] font-normal text-slate-400">Visible to search & AI shopping assistants</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your store catalog, specialties, and customer guarantees..."
                disabled={isStoreLoading || isSaving}
                className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-900 resize-none disabled:opacity-60"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {isFormDirty ? (
                <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Unsaved changes
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  All changes saved to PostgreSQL
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isFormDirty && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  disabled={isSaving}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Discard Changes
                </button>
              )}

              <button
                type="submit"
                disabled={isSaving || isStoreLoading || !isFormDirty}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to API...</span>
                  </>
                ) : (
                  <span>Save Store Details</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Store Visibility & Status Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
              store?.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
            }`}>
              {store?.status === 'PUBLISHED' ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Storefront Publishing & Visibility Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {store?.status === 'PUBLISHED' 
                  ? 'Your store is currently live and published. Customers can browse products and receive AI personalized deals.' 
                  : 'Your store is currently unpublished (draft mode). It is safe for catalog adjustments and testing.'}
              </p>
            </div>
          </div>

          <div>
            {store?.status === 'PUBLISHED' ? (
              <button
                onClick={() => {
                  setExperience('customer');
                  setCustomerTab('storefront');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <span>View Live Store</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange('PUBLISHED')}
                disabled={isUpdatingStatus || isStoreLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                {isUpdatingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Publish Now</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
