import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  Product, 
  AIConstraints, 
  CartItem, 
  CustomerOrder, 
  SimulationContext, 
  SimulationOutcome, 
  AIChatTurn,
  Store,
  Merchant,
  DbProduct
} from '../types';
import { INITIAL_AI_CONSTRAINTS, INITIAL_SIMULATION_CONTEXT, SIMULATION_SCENARIOS, DEFAULT_AI_CHAT_TURNS } from '../data/mockData';
import { storeService } from '../services/store.service';
import { merchantService } from '../services/merchant.service';
import { productService } from '../services/product.service';
import { mapDbProductToProduct } from '../utils/productMapper';

export type MerchantTab = 
  | 'dashboard' 
  | 'products' 
  | 'add-product' 
  | 'csv-import' 
  | 'store-management' 
  | 'ai-control' 
  | 'discount-optimizer' 
  | 'analytics' 
  | 'settings';

export type CustomerTab = 
  | 'home'
  | 'shop'
  | 'ai-assistant'
  | 'storefront' 
  | 'categories'
  | 'product-detail' 
  | 'cart' 
  | 'checkout' 
  | 'confirmation' 
  | 'orders';

interface CommerceContextType {
  experience: 'merchant' | 'customer';
  setExperience: (exp: 'merchant' | 'customer') => void;
  
  merchantTab: MerchantTab;
  setMerchantTab: (tab: MerchantTab) => void;
  
  customerTab: CustomerTab;
  setCustomerTab: (tab: CustomerTab) => void;
  
  // Products
  products: Product[];
  isProductsLoading: boolean;
  productsError: string | null;
  refreshProducts: (targetStoreId?: string) => Promise<Product[]>;
  loadProductDetails: (id: string) => Promise<Product | null>;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  importCSVProducts: (items: Partial<Product>[]) => void;
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;

  // AI Constraints
  constraints: AIConstraints;
  updateConstraints: (newConstraints: Partial<AIConstraints>) => void;
  resetConstraints: () => void;
  isConstraintsDirty: boolean;
  saveConstraints: () => void;
  discardConstraints: () => void;

  // Simulation
  simulationContext: SimulationContext;
  setSimulationContext: (ctx: SimulationContext) => void;
  scenarios: SimulationOutcome[];
  runNewSimulation: () => void;

  // Customer Search & AI Chat
  manualSearchQuery: string;
  setManualSearchQuery: (query: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchFilterAdjustment: string | null;
  setSearchFilterAdjustment: (filter: string | null) => void;
  filteredRecommendations: Product[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  aiChatTurns: AIChatTurn[];
  askAIAssistant: (prompt: string) => void;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  cartSavings: number;
  cartTotal: number;

  // Orders
  orders: CustomerOrder[];
  lastCompletedOrder: CustomerOrder | null;
  placeOrder: (customerDetails: { name: string; email: string; address: string }) => CustomerOrder;

  // Exit intent & recovery
  showExitIntentModal: boolean;
  setShowExitIntentModal: (show: boolean) => void;

  // Merchant & Store backend integration
  store: Store | null;
  merchant: Merchant | null;
  isStoreLoading: boolean;
  storeError: string | null;
  refreshStore: (slug?: string) => Promise<Store | null>;
  setStore: React.Dispatch<React.SetStateAction<Store | null>>;

  // Helper
  formatINR: (amount: number) => string;
  formatPrice: (amount: number) => string;
}

const CommerceContext = createContext<CommerceContextType | undefined>(undefined);

export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const [experience, setExperience] = useState<'merchant' | 'customer'>('customer');
  const [merchantTab, setMerchantTab] = useState<MerchantTab>('ai-control');
  const [customerTab, setCustomerTab] = useState<CustomerTab>('home');
  
  // Real Backend Store & Merchant state
  const [store, setStore] = useState<Store | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isStoreLoading, setIsStoreLoading] = useState<boolean>(true);
  const [storeError, setStoreError] = useState<string | null>(null);

  // Live Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Fetch products for a specific store from GET /api/products?storeId={storeId}&status=PUBLISHED
  const refreshProducts = useCallback(async (targetStoreId?: string): Promise<Product[]> => {
    const storeIdToUse = targetStoreId || store?.id;
    if (!storeIdToUse) {
      setProducts([]);
      setIsProductsLoading(false);
      return [];
    }

    setIsProductsLoading(true);
    setProductsError(null);
    try {
      const dbProducts = await productService.getProducts({
        storeId: storeIdToUse,
        status: 'PUBLISHED',
      });

      // Filter: Only Published products with in-stock inventory (> 0)
      const publishedInStock = dbProducts.filter(
        (p) => p.status === 'PUBLISHED' && Number(p.stock) > 0
      );

      const mappedProducts = publishedInStock.map(mapDbProductToProduct);
      setProducts(mappedProducts);

      // Keep selectedProduct in sync
      setSelectedProduct((prev) => {
        if (!prev) return mappedProducts[0] || null;
        const exists = mappedProducts.find((p) => p.id === prev.id);
        return exists || mappedProducts[0] || null;
      });

      return mappedProducts;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to load products for store';
      setProductsError(errorMsg);
      return [];
    } finally {
      setIsProductsLoading(false);
    }
  }, [store?.id]);

  // Load fresh single product details from GET /api/products/:id with store verification
  const loadProductDetails = useCallback(async (id: string): Promise<Product | null> => {
    try {
      const dbProd = await productService.getProduct(id);
      if (!dbProd) return null;
      // Scoped verification: ensure product belongs to active store
      if (store?.id && dbProd.storeId !== store.id) {
        console.warn(`Product ${id} does not belong to active store ${store.id}`);
        return null;
      }
      return mapDbProductToProduct(dbProd);
    } catch (err: any) {
      console.warn(`Error loading details for product ${id}:`, err);
      return null;
    }
  }, [store?.id]);

  // Refresh Store from GET /api/stores/:slug
  const refreshStore = useCallback(async (customSlug?: string): Promise<Store | null> => {
    setIsStoreLoading(true);
    setStoreError(null);
    try {
      const activeSlug = customSlug || localStorage.getItem('opticommerce_store_slug') || 'opticommerce-flagship-electronics';
      const fetchedStore = await storeService.getStore(activeSlug);
      setStore(fetchedStore);
      if (fetchedStore.merchant) {
        setMerchant(fetchedStore.merchant);
      }
      localStorage.setItem('opticommerce_store_slug', fetchedStore.slug);
      if (fetchedStore.merchantId) {
        localStorage.setItem('opticommerce_merchant_id', fetchedStore.merchantId);
      }

      // Automatically fetch products for the resolved store
      await refreshProducts(fetchedStore.id);

      setIsStoreLoading(false);
      return fetchedStore;
    } catch (err: any) {
      console.warn('Could not fetch store by slug:', err);
      // Fallback: try merchant ID if stored
      const savedMerchantId = localStorage.getItem('opticommerce_merchant_id');
      if (savedMerchantId) {
        try {
          const fetchedMerchant = await merchantService.getMerchant(savedMerchantId);
          setMerchant(fetchedMerchant);
          if (fetchedMerchant.store) {
            setStore(fetchedMerchant.store);
            localStorage.setItem('opticommerce_store_slug', fetchedMerchant.store.slug);
            await refreshProducts(fetchedMerchant.store.id);
            setIsStoreLoading(false);
            return fetchedMerchant.store;
          }
        } catch {
          // ignore
        }
      }
      setStoreError(err?.message || 'Failed to load store data');
      setIsStoreLoading(false);
      return null;
    }
  }, [refreshProducts]);

  useEffect(() => {
    refreshStore();
  }, [refreshStore]);

  // AI constraints
  const [savedConstraints, setSavedConstraints] = useState<AIConstraints>(INITIAL_AI_CONSTRAINTS);
  const [constraints, setConstraints] = useState<AIConstraints>(INITIAL_AI_CONSTRAINTS);
  const [isConstraintsDirty, setIsConstraintsDirty] = useState(false);

  // Simulation
  const [simulationContext, setSimulationContext] = useState<SimulationContext>(INITIAL_SIMULATION_CONTEXT);
  const [scenarios, setScenarios] = useState<SimulationOutcome[]>(SIMULATION_SCENARIOS);

  // Search & Recommendations
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('Can you find me some wireless headphones under ₹5,000 with really strong bass?');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchFilterAdjustment, setSearchFilterAdjustment] = useState<string | null>(null);
  const [aiChatTurns, setAiChatTurns] = useState<AIChatTurn[]>(DEFAULT_AI_CHAT_TURNS);

  const askAIAssistant = (prompt: string) => {
    setSearchQuery(prompt);
    const lower = prompt.toLowerCase();
    
    // Filter matching products dynamically from the live products in store
    const matched = products.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      p.description.toLowerCase().includes(lower) ||
      p.tags.some(t => t.toLowerCase().includes(lower)) ||
      p.category.toLowerCase().includes(lower) ||
      (p.brand && p.brand.toLowerCase().includes(lower))
    );

    const matchingProducts: Product[] = matched.length >= 1 ? matched.slice(0, 3) : products.slice(0, 3);
    const summary = matchingProducts.length > 0
      ? `I found ${matchingProducts.length} product${matchingProducts.length > 1 ? 's' : ''} that match your query in ${store?.name || 'our store'}:`
      : `No published items matched '${prompt}'. Here are our featured products:`;
    const note = matchingProducts.length > 0
      ? `Top match: ${matchingProducts[0].name} (${formatINR(matchingProducts[0].basePrice)}) with in-stock availability.`
      : `Check out our published catalog items below.`;

    const followUps = [
      'Compare technical specifications',
      'Show me products under ₹5,000',
      'Are there other colorways or models?'
    ];

    const newTurn: AIChatTurn = {
      id: `turn-${Date.now()}`,
      userPrompt: prompt,
      assistantSummary: summary,
      highlightNote: note,
      totalFound: matchingProducts.length,
      recommendedProducts: matchingProducts,
      suggestedFollowUps: followUps,
    };

    setAiChatTurns(prev => [...prev, newTurn]);
    setCustomerTab('ai-assistant');
  };

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Orders
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<CustomerOrder | null>(null);
  const [showExitIntentModal, setShowExitIntentModal] = useState(false);

  // Check dirty constraints
  useEffect(() => {
    const isDirty = JSON.stringify(constraints) !== JSON.stringify(savedConstraints);
    setIsConstraintsDirty(isDirty);
  }, [constraints, savedConstraints]);

  const updateConstraints = (newConstraints: Partial<AIConstraints>) => {
    setConstraints(prev => ({ ...prev, ...newConstraints }));
  };

  const saveConstraints = () => {
    setSavedConstraints(constraints);
    setIsConstraintsDirty(false);
  };

  const discardConstraints = () => {
    setConstraints(savedConstraints);
    setIsConstraintsDirty(false);
  };

  const resetConstraints = () => {
    setConstraints(INITIAL_AI_CONSTRAINTS);
    setSavedConstraints(INITIAL_AI_CONSTRAINTS);
    setIsConstraintsDirty(false);
  };

  const addProduct = (newProd: Omit<Product, 'id'>) => {
    const id = `prod-${Date.now()}`;
    const product: Product = { ...newProd, id };
    setProducts(prev => [product, ...prev]);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const importCSVProducts = (items: Partial<Product>[]) => {
    const newItems: Product[] = items.map((item, idx) => ({
      id: `prod-csv-${Date.now()}-${idx}`,
      name: item.name || 'Imported Product',
      category: item.category || 'General',
      basePrice: item.basePrice || 999,
      costPrice: item.costPrice || 600,
      marginPercent: item.marginPercent || Math.round((( (item.basePrice || 999) - (item.costPrice || 600) ) / (item.basePrice || 999)) * 100),
      stock: item.stock || 50,
      rating: item.rating || 4.5,
      ratingCount: item.ratingCount || 10,
      image: item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
      description: item.description || 'Quality product imported into OptiCommerce catalog.',
      tags: item.tags || ['Catalog'],
      aiDiscountEligible: true,
      activeDiscountPercent: 0,
      isLive: true,
    }));
    setProducts(prev => [...newItems, ...prev]);
  };

  const runNewSimulation = () => {
    const randomIntent = Math.floor(Math.random() * 30) + 45; // 45-75%
    setSimulationContext({
      targetProfileName: Math.random() > 0.5 ? 'Returning Customer' : 'Cart Abandoner',
      targetProfileType: 'High lifetime value, price sensitive on electronics.',
      targetProfileNotes: 'Customer hovered on price breakdown and viewed alternative items.',
      activeCartItemId: 'prod-4',
      calculatedPurchaseIntent: randomIntent,
      intentSummary: randomIntent > 60 
        ? '"Customer intent is moderately strong. Mild 5% nudge creates maximum margin yield."' 
        : '"Customer is on the fence. Slight nudge required to close without margin erosion."',
    });
  };

  // Recommendations filtering based on current query & feedback pills
  const filteredRecommendations = products.filter(p => {
    if (!p.isLive) return false;
    if (searchFilterAdjustment === 'too-expensive') {
      return p.basePrice <= 3500;
    }
    if (searchFilterAdjustment === 'dont-like-design') {
      return p.category === 'Audio';
    }
    if (searchFilterAdjustment === 'need-better-features') {
      return p.rating >= 4.5;
    }
    return true;
  });

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      
      // Calculate AI discount respecting merchant constraints
      let discount = 0;
      let reason = undefined;
      if (constraints.allowPersonalizedDiscounts && product.aiDiscountEligible) {
        // Cap by merchant maximum discount limit
        const maxDiscount = constraints.maxDiscountLimit;
        discount = Math.min(product.activeDiscountPercent || 5, maxDiscount);
        reason = `${discount}% AI Revenue Optimizer Nudge`;
      }

      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity, appliedDiscountPercent: discount, discountReason: reason }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity } : item));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const cartSubtotal = cart.reduce((acc, item) => {
    return acc + (item.product.basePrice * item.quantity);
  }, 0);

  const cartSavings = cart.reduce((acc, item) => {
    const itemSub = item.product.basePrice * item.quantity;
    const discountAmt = itemSub * (item.appliedDiscountPercent / 100);
    return acc + discountAmt;
  }, 0);

  const cartTotal = Math.max(0, cartSubtotal - cartSavings);

  const placeOrder = (customerDetails: { name: string; email: string; address: string }) => {
    const newOrder: CustomerOrder = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      items: [...cart],
      subtotal: cartSubtotal,
      discountAmount: cartSavings,
      total: cartTotal,
      status: 'Processing',
      customerName: customerDetails.name,
      customerEmail: customerDetails.email,
      shippingAddress: customerDetails.address,
      aiSavings: cartSavings,
    };
    setOrders(prev => [newOrder, ...prev]);
    setLastCompletedOrder(newOrder);
    clearCart();
    setCustomerTab('confirmation');
    return newOrder;
  };

  const formatINR = (amount: number) => {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  };

  const formatPrice = (amount: number) => {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  };

  return (
    <CommerceContext.Provider
      value={{
        experience,
        setExperience,
        merchantTab,
        setMerchantTab,
        customerTab,
        setCustomerTab,
        products,
        isProductsLoading,
        productsError,
        refreshProducts,
        loadProductDetails,
        addProduct,
        updateProduct,
        deleteProduct,
        importCSVProducts,
        selectedProduct,
        setSelectedProduct,
        constraints,
        updateConstraints,
        resetConstraints,
        isConstraintsDirty,
        saveConstraints,
        discardConstraints,
        simulationContext,
        setSimulationContext,
        scenarios,
        runNewSimulation,
        manualSearchQuery,
        setManualSearchQuery,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        searchFilterAdjustment,
        setSearchFilterAdjustment,
        filteredRecommendations,
        aiChatTurns,
        askAIAssistant,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartCount,
        cartSubtotal,
        cartSavings,
        cartTotal,
        orders,
        lastCompletedOrder,
        placeOrder,
        showExitIntentModal,
        setShowExitIntentModal,
        store,
        merchant,
        isStoreLoading,
        storeError,
        refreshStore,
        setStore,
        formatINR,
        formatPrice,
      }}
    >
      {children}
    </CommerceContext.Provider>
  );
}

export function useCommerce() {
  const ctx = useContext(CommerceContext);
  if (!ctx) throw new Error('useCommerce must be used within CommerceProvider');
  return ctx;
}
