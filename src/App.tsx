import React, { useState } from 'react';
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
import { ExperienceSwitcher } from './components/common/ExperienceSwitcher';
import { Product } from './types';

function MainLayout() {
  const { 
    experience, 
    merchantTab, 
    customerTab, 
    setCustomerTab, 
    products, 
    addToCart,
    showExitIntentModal, 
    setShowExitIntentModal 
  } = useCommerce();

  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Customer Modals & State
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Experience Switcher */}
      <ExperienceSwitcher />

      {experience === 'merchant' ? (
        /* MERCHANT SUITE EXPERIENCE */
        isAuthLoading ? (
          <div className="min-h-[80vh] flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-slate-500 mt-3">Verifying merchant session...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex-1 flex flex-col">
            <MerchantHeader />
            <div className="flex-1 flex items-center justify-center p-6 bg-[#F8FAFC]">
              <MerchantAuth />
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
        /* CUSTOMER STOREFRONT EXPERIENCE */
        <div className="min-h-screen flex flex-col bg-white">
          <CustomerHeader onOpenCart={() => setIsCartOpen(true)} />

          <main className="flex-1">
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
