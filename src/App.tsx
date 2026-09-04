import React, { useState, useEffect } from 'react';
import { CommerceProvider, useCommerce } from './context/CommerceContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MerchantSidebar } from './components/merchant/MerchantSidebar';
import { MerchantHeader } from './components/merchant/MerchantHeader';
import { MerchantAuth } from './components/merchant/MerchantAuth';
import { AIControlCenter } from './components/merchant/AIControlCenter';
import { DiscountOptimizer } from './components/merchant/DiscountOptimizer';
import { Dashboard } from './components/merchant/Dashboard';
import { ProductCatalog } from './components/merchant/ProductCatalog';
import { RevenueAnalytics } from './components/merchant/RevenueAnalytics';
import { StoreManagement } from './components/merchant/StoreManagement';
import { OrdersManagement } from './components/merchant/OrdersManagement';

import { CustomerHeader } from './components/customer/CustomerHeader';
import { CustomerHome } from './components/customer/CustomerHome';
import { AIChatShoppingView } from './components/customer/AIChatShoppingView';
import { ManualShopView } from './components/customer/ManualShopView';
import { StorefrontAISearch } from './components/customer/StorefrontAISearch';
import { ProductDetailsModal } from './components/customer/ProductDetailsModal';
import { CartDrawer } from './components/customer/CartDrawer';
import { CheckoutModal } from './components/customer/CheckoutModal';
import { OrderConfirmationView } from './components/customer/OrderConfirmationView';
import { OrdersView } from './components/customer/OrdersView';
import { CustomerRecoveryModal } from './components/customer/CustomerRecoveryModal';
import { CustomerFooter } from './components/customer/CustomerFooter';
import { CustomerLogin } from './components/customer/CustomerLogin';
import { Product } from './types';

function MainLayout() {
  const { 
    experience,
    setExperience,
    merchantTab, 
    setMerchantTab,
    customerTab, 
    setCustomerTab, 
    products, 
    store,
    addToCart,
    showExitIntentModal, 
    setShowExitIntentModal 
  } = useCommerce();

  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // URL-based routing state using lightweight native browser routing
  const [currentPath, setCurrentPath] = useState<string>(() => 
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    if (typeof window !== 'undefined' && to !== window.location.pathname) {
      window.history.pushState({}, '', to);
      setCurrentPath(to);
    }
  };

  // Top-level experience boundary derived from URL
  const isMerchantRoute = currentPath.startsWith('/merchant');

  // Synchronize in-memory experience state in CommerceContext with URL
  useEffect(() => {
    if (isMerchantRoute) {
      if (experience !== 'merchant') {
        setExperience('merchant');
      }
    } else {
      if (experience !== 'customer') {
        setExperience('customer');
      }
    }
  }, [isMerchantRoute, experience, setExperience]);

  // Derive active merchant tab from URL if present
  useEffect(() => {
    if (isMerchantRoute && isAuthenticated) {
      const match = currentPath.match(/^\/merchant\/(dashboard|orders|products|store-management|ai-control|discount-optimizer|analytics|settings)/i);
      if (match && match[1]) {
        const urlTab = match[1].toLowerCase() as typeof merchantTab;
        if (urlTab !== merchantTab) {
          setMerchantTab(urlTab);
        }
      }
    }
  }, [currentPath, isMerchantRoute, isAuthenticated, merchantTab, setMerchantTab]);

  // Customer sub-route parsing: /store/:slug/login, /store/:slug, /login, etc.
  const storeSlugMatch = currentPath.match(/^\/store\/([^/]+)/i);
  const activeSlug = storeSlugMatch ? storeSlugMatch[1] : undefined;
  const isCustomerLogin = !isMerchantRoute && (currentPath.endsWith('/login') || currentPath === '/login');

  // Determine initial mode for MerchantAuth if unauthenticated
  const merchantAuthMode = currentPath === '/merchant/register' ? 'register' : 'login';

  // Customer Modals & State
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {isMerchantRoute ? (
        /* MERCHANT SUITE EXPERIENCE (/merchant/*) */
        isAuthLoading ? (
          <div className="min-h-[80vh] flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-slate-500 mt-3">Verifying merchant session...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex-1 flex flex-col">
            <MerchantHeader />
            <div className="flex-1 flex items-center justify-center p-6 bg-[#F8FAFC]">
              <MerchantAuth initialMode={merchantAuthMode} />
            </div>
          </div>
        ) : (
          <div className="flex h-screen overflow-hidden">
            <MerchantSidebar />
            
            <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
              <MerchantHeader />
              
              <section className="flex-1 overflow-y-auto bg-[#F8FAFC]">
                {merchantTab === 'ai-control' && <AIControlCenter />}
                {merchantTab === 'discount-optimizer' && <DiscountOptimizer />}
                {merchantTab === 'dashboard' && <Dashboard />}
                {merchantTab === 'orders' && <OrdersManagement />}
                {merchantTab === 'products' && <ProductCatalog />}
                {merchantTab === 'store-management' && <StoreManagement />}
                {merchantTab === 'analytics' && <RevenueAnalytics />}
                {merchantTab === 'settings' && <StoreManagement />}
              </section>
            </main>
          </div>
        )
      ) : (
        /* CUSTOMER STOREFRONT EXPERIENCE (/, /store/:slug, /store/:slug/*) */
        <div className="min-h-screen flex flex-col bg-white">
          <CustomerHeader 
            onOpenCart={() => setIsCartOpen(true)} 
            onOpenLogin={() => {
              const targetSlug = store?.slug || activeSlug || 'opticommerce-flagship-electronics';
              navigate(`/store/${targetSlug}/login`);
            }}
          />

          <main className="flex-1">
            {isCustomerLogin ? (
              <CustomerLogin 
                storeSlug={activeSlug}
                onNavigate={navigate}
              />
            ) : (
              <>
                {(customerTab === 'home' || customerTab === 'categories') && (
                  <CustomerHome
                    onSelectProduct={(prod) => setSelectedProductForModal(prod)}
                    onOpenCart={() => setIsCartOpen(true)}
                  />
                )}

                {(customerTab === 'ai-assistant' || customerTab === 'storefront') && (
                  <AIChatShoppingView
                    onSelectProduct={(prod) => setSelectedProductForModal(prod)}
                    onOpenCart={() => setIsCartOpen(true)}
                  />
                )}

                {customerTab === 'shop' && (
                  <ManualShopView
                    onSelectProduct={(prod) => setSelectedProductForModal(prod)}
                    onOpenCart={() => setIsCartOpen(true)}
                  />
                )}

                {customerTab === 'orders' && <OrdersView />}
                {customerTab === 'confirmation' && <OrderConfirmationView />}
              </>
            )}
          </main>

          <CustomerFooter />

          {/* Product Details Modal */}
          {selectedProductForModal && (
            <ProductDetailsModal
              product={selectedProductForModal}
              onClose={() => setSelectedProductForModal(null)}
              onOpenCart={() => {
                setSelectedProductForModal(null);
                setIsCartOpen(true);
              }}
            />
          )}

          {/* Cart Drawer */}
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            onProceedToCheckout={() => {
              setIsCartOpen(false);
              setIsCheckoutOpen(true);
            }}
          />

          {/* Checkout Modal */}
          <CheckoutModal
            isOpen={isCheckoutOpen}
            onClose={() => setIsCheckoutOpen(false)}
          />

          {/* Customer Recovery Modal (Triggerable on exit-intent or manual simulation) */}
          <CustomerRecoveryModal
            isOpen={showExitIntentModal}
            onClose={() => setShowExitIntentModal(false)}
            onApplyRecoveryDeal={() => {
              setShowExitIntentModal(false);
              addToCart(products[1], 1);
              setIsCartOpen(true);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CommerceProvider>
        <MainLayout />
      </CommerceProvider>
    </AuthProvider>
  );
}
