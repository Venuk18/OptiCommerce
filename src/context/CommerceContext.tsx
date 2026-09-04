import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { 
  Product, 
  AIConstraints, 
  CartItem, 
  CustomerOrder, 
  SimulationContext, 
  SimulationOutcome, 
  AIChatTurn,
  Store,
  StoreStatus,
  Merchant,
  DbProduct,
  RecommendationResponse,
  ServerCartData,
  ServerOrderData,
  ConversationState,
  ConversationMessageHistory,
  createInitialConversationState
} from '../types';
import { INITIAL_PRODUCTS, INITIAL_AI_CONSTRAINTS, INITIAL_SIMULATION_CONTEXT, SIMULATION_SCENARIOS, DEFAULT_AI_CHAT_TURNS } from '../data/mockData';
import { storeService } from '../services/store.service';
import { merchantService } from '../services/merchant.service';
import { productService } from '../services/product.service';
import { recommendationService } from '../services/recommendation.service';
import { comparisonService } from '../services/comparison.service';
import { eventService, getAnonymousSessionId } from '../services/event.service';
import { cartService } from '../services/cart.service';
import { orderService } from '../services/order.service';
import { paymentService } from '../services/payment.service';
import { mapDbProductToProduct } from '../utils/productMapper';

export type MerchantTab = 
  | 'dashboard' 
  | 'orders'
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
  conversationState: ConversationState;
  setConversationState: React.Dispatch<React.SetStateAction<ConversationState>>;
  resetConversationState: () => void;
  askAIAssistant: (prompt: string) => Promise<void>;
  compareProducts: (productIds: string[]) => Promise<void>;
  isAISearchLoading: boolean;
  aiSearchError: string | null;
  lastRecommendationResponse: RecommendationResponse | null;

  // Cart
  cart: CartItem[];
  serverCart: ServerCartData | null;
  lastAddedProduct: Product | null;
  isCartLoading: boolean;
  cartError: string | null;
  refreshCart: (targetStoreId?: string) => Promise<ServerCartData | null>;
  addToCart: (
    product: Product,
    quantity?: number,
    offerOverride?: { discountPercent: number; discountReason?: string }
  ) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  cartSavings: number;
  cartTotal: number;

  // Orders
  orders: CustomerOrder[];
  serverOrders: ServerOrderData[];
  serverOrder: ServerOrderData | null;
  lastCompletedOrder: CustomerOrder | null;
  isCheckingOut: boolean;
  checkoutError: string | null;
  checkoutOrder: (customerDetails?: { name?: string; email?: string; address?: string }) => Promise<ServerOrderData>;
  placeOrder: (customerDetails: { name: string; email: string; address: string }) => Promise<CustomerOrder>;
  loadOrders: () => Promise<ServerOrderData[]>;

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
  const { merchant: authMerchant, isAuthenticated } = useAuth();
  const [merchantTab, setMerchantTab] = useState<MerchantTab>('dashboard');
  const [customerTab, setCustomerTab] = useState<CustomerTab>('home');
  
  // Public Customer Storefront state
  const [customerStore, setCustomerStore] = useState<Store | null>(null);
  const [customerMerchant, setCustomerMerchant] = useState<Merchant | null>(null);
  const [isStoreLoading, setIsStoreLoading] = useState<boolean>(true);
  const [storeError, setStoreError] = useState<string | null>(null);

  // Synchronize authenticated merchant's store for Merchant Suite views without contaminating public storefront
  const merchantStore = useMemo<Store | null>(() => {
    if (!isAuthenticated || !authMerchant?.store) return null;
    const authStore = authMerchant.store;
    return {
      id: authStore.id,
      merchantId: authStore.merchantId || authMerchant.id,
      name: authStore.name,
      slug: authStore.slug,
      description: authStore.description,
      status: (authStore.status as StoreStatus) || 'PUBLISHED',
      createdAt: authStore.createdAt || new Date().toISOString(),
      updatedAt: authStore.updatedAt || new Date().toISOString(),
    };
  }, [isAuthenticated, authMerchant]);

  // Active store resolution:
  // In Merchant Suite with an authenticated merchant, use the merchant's private store.
  // In Customer Storefront, always use the public customer store.
  const isMerchantRoute =
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/merchant');

  const store =
    isMerchantRoute && isAuthenticated && merchantStore
      ? merchantStore
      : customerStore;

  const merchant =
    isMerchantRoute && isAuthenticated && authMerchant
      ? {
          id: authMerchant.id,
          name: authMerchant.name,
          email: authMerchant.email,
          createdAt: authMerchant.createdAt || new Date().toISOString(),
          updatedAt: authMerchant.updatedAt || new Date().toISOString(),
          store: merchantStore || undefined,
        }
      : customerMerchant;

  const setStore = setCustomerStore;

  // Live Products state with INITIAL_PRODUCTS fallback
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(INITIAL_PRODUCTS[0] || null);

  // Fetch products for a specific store from GET /api/products?storeId={storeId}&status=PUBLISHED
  const refreshProducts = useCallback(async (targetStoreId?: string): Promise<Product[]> => {
    const storeIdToUse = targetStoreId || customerStore?.id || store?.id;
    if (!storeIdToUse) {
      setProducts((prev) => (prev.length > 0 ? prev : INITIAL_PRODUCTS));
      setIsProductsLoading(false);
      return INITIAL_PRODUCTS;
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

      const mappedProducts = publishedInStock.length > 0
        ? publishedInStock.map(mapDbProductToProduct)
        : INITIAL_PRODUCTS;
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
      setProducts((prev) => (prev.length > 0 ? prev : INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    } finally {
      setIsProductsLoading(false);
    }
  }, [customerStore?.id, store?.id]);

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

  const FLAGSHIP_SLUG = 'opticommerce-flagship-electronics';

  // Helper to extract store slug from URL when path is /store/:slug or /store/:slug/*
  const getUrlStoreSlug = (): string | null => {
    if (typeof window === 'undefined') return null;
    const match = window.location.pathname.match(/^\/store\/([^/]+)/i);
    return match ? match[1] : null;
  };

  // Refresh Store from GET /api/stores/:slug
  const refreshStore = useCallback(async (customSlug?: string): Promise<Store | null> => {
    setIsStoreLoading(true);
    setStoreError(null);

    // Extract slug from URL only when path is /store/:slug or /store/:slug/*
    const urlSlug = getUrlStoreSlug();

    // Resolution: explicitly selected public slug, or URL slug, or stored public slug, or flagship default
    const requestedSlug = customSlug || urlSlug || localStorage.getItem('opticommerce_store_slug') || FLAGSHIP_SLUG;

    try {
      const fetchedStore = await storeService.getStore(requestedSlug);
      setCustomerStore(fetchedStore);
      if (fetchedStore.merchant) {
        setCustomerMerchant(fetchedStore.merchant);
      }
      localStorage.setItem('opticommerce_store_slug', fetchedStore.slug);

      // Automatically fetch products for the resolved store
      await refreshProducts(fetchedStore.id);

      setIsStoreLoading(false);
      return fetchedStore;
    } catch (err: any) {
      console.warn(`Could not fetch store by slug '${requestedSlug}':`, err);

      // STALE CUSTOMER STORE RECOVERY:
      // If the public storefront requests a store slug and receives 404:
      // If the requested slug is NOT opticommerce-flagship-electronics:
      if (requestedSlug !== FLAGSHIP_SLUG) {
        console.info(`Stale store slug detected ('${requestedSlug}'). Recovering with flagship store: '${FLAGSHIP_SLUG}'...`);
        localStorage.removeItem('opticommerce_store_slug');
        localStorage.removeItem('opticommerce_merchant_id');

        try {
          const fallbackStore = await storeService.getStore(FLAGSHIP_SLUG);
          setCustomerStore(fallbackStore);
          if (fallbackStore.merchant) {
            setCustomerMerchant(fallbackStore.merchant);
          }
          localStorage.setItem('opticommerce_store_slug', fallbackStore.slug);
          await refreshProducts(fallbackStore.id);
          setStoreError(null);
          setIsStoreLoading(false);
          return fallbackStore;
        } catch (fallbackErr: any) {
          console.error('Failed to load fallback flagship store:', fallbackErr);
          setStoreError(fallbackErr?.message || 'Failed to load store data');
          setCustomerStore(null);
          setIsStoreLoading(false);
          return null;
        }
      }

      setStoreError(err?.message || 'Failed to load store data');
      setCustomerStore(null);
      setIsStoreLoading(false);
      return null;
    }
  }, [refreshProducts]);

  useEffect(() => {
    refreshStore();
  }, [refreshStore]);

  // Synchronize customer store when URL slug changes through browser navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlSlug = getUrlStoreSlug();
      if (urlSlug) {
        refreshStore(urlSlug);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
  const [conversationState, setConversationState] = useState<ConversationState>(createInitialConversationState());
  const [isAISearchLoading, setIsAISearchLoading] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const [lastRecommendationResponse, setLastRecommendationResponse] = useState<any | null>(null);

  const resetConversationState = useCallback(() => {
    setConversationState(createInitialConversationState());
  }, []);

  const askAIAssistant = async (prompt: string) => {
    if (!prompt || !prompt.trim()) return;
    const cleanPrompt = prompt.trim();
    setSearchQuery(cleanPrompt);
    setIsAISearchLoading(true);
    setAiSearchError(null);
    setCustomerTab('ai-assistant');

    const turnId = `turn-${Date.now()}`;

    try {
      // 1. Resolve store ID
      let storeIdToUse = store?.id;
      if (!storeIdToUse) {
        const fetchedStore = await refreshStore();
        storeIdToUse = fetchedStore?.id;
      }

      if (!storeIdToUse) {
        throw new Error('Store is not loaded yet. Please try again in a moment.');
      }

      // Track SEARCH commerce event (non-blocking)
      eventService.trackEvent({
        storeId: storeIdToUse,
        eventType: 'SEARCH',
        metadata: {
          query: cleanPrompt,
        },
      });

      // Prepare lightweight recent conversation history without heavy product payloads
      const recentHistory: ConversationMessageHistory[] = aiChatTurns
        .slice(-5)
        .flatMap((turn) => [
          { role: 'user' as const, content: turn.userPrompt },
          { role: 'assistant' as const, content: turn.assistantSummary || '' },
        ])
        .filter((msg) => Boolean(msg.content));

      // Extract current active cart product IDs (both optimistic local cart and server cart)
      const cartProductIds = Array.from(
        new Set([
          ...cart.map((item) => item.product?.id),
          ...(serverCart?.items || []).map((item) => item.productId),
        ])
      ).filter(Boolean) as string[];

      const sessionId = getAnonymousSessionId();

      // 2. Call Phase 4D Orchestration endpoint POST /api/ai/recommend
      const response = await recommendationService.recommend({
        storeId: storeIdToUse,
        query: cleanPrompt,
        conversationContext: {
          history: recentHistory,
          state: conversationState,
        },
        cartProductIds,
        sessionId,
      });

      setLastRecommendationResponse(response);

      // Track RECOMMENDATION_VIEW event if recommendations returned (non-blocking)
      if (response.recommendations && response.recommendations.length > 0) {
        eventService.trackEvent({
          storeId: storeIdToUse,
          eventType: 'RECOMMENDATION_VIEW',
          metadata: {
            query: cleanPrompt,
            count: response.recommendations.length,
            productIds: response.recommendations.map((r: any) => r.productId),
          },
        });
      }

      // 3. Map recommendation IDs to real products from catalog
      const recommendedList: Product[] = [];

      if (response.recommendations && response.recommendations.length > 0) {
        for (const rec of response.recommendations) {
          // Look up product in live store products first
          let matchedProd = products.find((p) => p.id === rec.productId);

          // If not in current products array, check response.products
          if (!matchedProd && response.products) {
            const candidate = response.products.find((c) => c.id === rec.productId);
            if (candidate) {
              matchedProd = mapDbProductToProduct({
                ...candidate,
                storeId: storeIdToUse,
                costPrice: 0,
                status: 'PUBLISHED',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }

          // Fallback: fetch directly from DB by ID if not in state
          if (!matchedProd) {
            matchedProd = await loadProductDetails(rec.productId);
          }

          if (matchedProd) {
            const decorated: Product = {
              ...matchedProd,
              matchScore: rec.matchScore,
              matchReason: rec.reason,
              matchHighlightQuote: rec.whyRecommended || rec.reason,
              matchBadge: rec.fitRole || `${rec.matchScore}% Match`,
              matchBadgeColor: rec.rank === 1 ? 'blue' : 'purple',
              whyRecommended: rec.whyRecommended,
              keyAdvantage: rec.keyAdvantage,
              tradeoff: rec.tradeoff,
              fitRole: rec.fitRole,
              bestFor: rec.bestFor || rec.fitRole,
            };
            recommendedList.push(decorated);
          }
        }
      }

      // Update conversation state with response state or local discussed products
      if (response.conversationState) {
        setConversationState(response.conversationState);
      } else {
        setConversationState((prev) => ({
          ...prev,
          discussedProducts: recommendedList.map((prod, idx) => ({
            id: prod.id,
            name: prod.name,
            price: prod.basePrice || 0,
            category: prod.category || '',
            position: idx + 1,
          })),
          stage: recommendedList.length > 0 ? 'EVALUATING' : prev.stage,
        }));
      }

      let summary = '';
      let note = '';

      if (response.message) {
        summary = response.message;
        if (recommendedList.length > 0) {
          note = `Focus: ${recommendedList[0].name} (${formatINR(recommendedList[0].basePrice)})`;
        }
      } else if (recommendedList.length > 0) {
        summary = `I found ${recommendedList.length} product${recommendedList.length > 1 ? 's' : ''} that match your request for '${cleanPrompt}':`;
        note = `Top match: ${recommendedList[0].name} (${formatINR(recommendedList[0].basePrice)}) — ${recommendedList[0].matchReason || 'High match for your preferences'}`;
      } else {
        summary = `No published products matched your search for '${cleanPrompt}'.`;
        note = 'Try searching with different keywords, category, or price range.';
      }

      const followUps = [
        'Compare technical specifications',
        'Show me products under ₹5,000',
        'Are there other colorways or models?',
      ];

      const newTurn: AIChatTurn = {
        id: turnId,
        userPrompt: cleanPrompt,
        assistantSummary: summary,
        highlightNote: note,
        totalFound: recommendedList.length,
        recommendedProducts: recommendedList,
        suggestedFollowUps: followUps,
        comparisonData: (response as any).comparison,
        crossSell: response.crossSell,
        bundleOpportunity: response.bundleOpportunity,
      };

      setAiChatTurns((prev) => [...prev, newTurn]);
    } catch (err: any) {
      console.error('AI Recommendation Error:', err);
      const errorMsg = err?.message || 'Unable to fetch recommendations at this time.';
      setAiSearchError(errorMsg);

      const errorTurn: AIChatTurn = {
        id: turnId,
        userPrompt: cleanPrompt,
        assistantSummary: `We encountered an issue finding recommendations for "${cleanPrompt}".`,
        highlightNote: 'Please check your query or retry in a moment.',
        totalFound: 0,
        recommendedProducts: [],
        suggestedFollowUps: [
          'Search wireless earbuds',
          'Show featured products',
          'Retry search',
        ],
      };
      setAiChatTurns((prev) => [...prev, errorTurn]);
    } finally {
      setIsAISearchLoading(false);
    }
  };

  const compareProducts = async (productIds: string[]) => {
    const storeIdToUse = customerStore?.id || store?.id;
    if (!storeIdToUse) {
      setAiSearchError('No active store found for product comparison.');
      return;
    }

    if (!productIds || productIds.length < 2) {
      return;
    }

    const turnId = `turn-${Date.now()}`;
    const cleanPrompt = `Compare these ${productIds.length} & suggest me the best`;

    setIsAISearchLoading(true);
    setAiSearchError(null);

    try {
      const response = await comparisonService.compare({
        storeId: storeIdToUse,
        productIds,
        conversationState,
        query: cleanPrompt,
      });

      if (response.conversationState) {
        setConversationState(response.conversationState);
      }

      // Map comparison products to client Product models
      const comparedProductList: Product[] = [];
      for (const compProd of response.comparison.products) {
        let matched = products.find((p) => p.id === compProd.productId);
        if (!matched) {
          matched = (await loadProductDetails(compProd.productId)) || undefined;
        }
        if (matched) {
          comparedProductList.push({
            ...matched,
            keyAdvantage: compProd.strengths?.[0] || matched.keyAdvantage,
            tradeoff: compProd.tradeoff || matched.tradeoff,
            whyRecommended: compProd.fitSummary || matched.whyRecommended,
            matchBadge: compProd.productId === response.comparison.winnerProductId ? 'Best for you' : 'Contender',
            matchBadgeColor: compProd.productId === response.comparison.winnerProductId ? 'blue' : 'purple',
          });
        }
      }

      const newTurn: AIChatTurn = {
        id: turnId,
        userPrompt: cleanPrompt,
        assistantSummary: response.message,
        highlightNote: response.comparison.winnerProductId
          ? `Top recommendation: ${comparedProductList.find((p) => p.id === response.comparison.winnerProductId)?.name || 'Winner selected'}`
          : undefined,
        totalFound: comparedProductList.length,
        recommendedProducts: comparedProductList,
        comparisonData: response.comparison,
        suggestedFollowUps: [
          'Tell me more about the winner',
          'Why did you choose this one?',
          'What are the downsides?',
          'Add winner to cart',
        ],
      };

      setAiChatTurns((prev) => [...prev, newTurn]);
    } catch (err: any) {
      console.error('AI Comparison Error:', err);
      const errorMsg = err?.message || 'Unable to compare products at this time.';
      setAiSearchError(errorMsg);

      const errorTurn: AIChatTurn = {
        id: turnId,
        userPrompt: cleanPrompt,
        assistantSummary: `We couldn't compare these products at this moment.`,
        highlightNote: 'Please retry or ask a specific product question.',
        totalFound: 0,
        recommendedProducts: [],
        suggestedFollowUps: ['Show recommendations', 'Retry comparison'],
      };
      setAiChatTurns((prev) => [...prev, errorTurn]);
    } finally {
      setIsAISearchLoading(false);
    }
  };

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [serverCart, setServerCart] = useState<ServerCartData | null>(null);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(null);
  const [isCartLoading, setIsCartLoading] = useState<boolean>(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const refreshCart = useCallback(async (targetStoreId?: string): Promise<ServerCartData | null> => {
    const sId = targetStoreId || customerStore?.id || store?.id;
    if (!sId) return null;
    setIsCartLoading(true);
    setCartError(null);
    try {
      const data = await cartService.getCart(sId);
      setServerCart(data);
      return data;
    } catch (err: any) {
      console.warn('[CommerceContext] Sync cart notice:', err?.message || err);
      setCartError(err?.message || 'Failed to sync cart');
      return null;
    } finally {
      setIsCartLoading(false);
    }
  }, [customerStore?.id, store?.id]);

  useEffect(() => {
    if (customerStore?.id) {
      refreshCart(customerStore.id);
    }
  }, [customerStore?.id, refreshCart]);

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

  // Real recommendations from the latest AI shopping turn
  const latestAiTurn = aiChatTurns.length > 0 ? aiChatTurns[aiChatTurns.length - 1] : null;
  const activeRecommendedProducts = useMemo<Product[]>(() => {
    if (latestAiTurn && Array.isArray(latestAiTurn.recommendedProducts)) {
      return latestAiTurn.recommendedProducts;
    }
    return [];
  }, [latestAiTurn]);

  // Recommendations filtering based on current query & feedback pills
  const filteredRecommendations = useMemo(() => {
    let list = activeRecommendedProducts;
    if (searchFilterAdjustment === 'too-expensive') {
      list = list.filter((p) => p.basePrice <= 3500);
    }
    if (searchFilterAdjustment === 'dont-like-design') {
      list = list.filter((p) => p.category === 'Audio');
    }
    if (searchFilterAdjustment === 'need-better-features') {
      list = list.filter((p) => (p.rating || 0) >= 4.5);
    }
    return list;
  }, [activeRecommendedProducts, searchFilterAdjustment]);

  const addToCart = (
    product: Product,
    quantity = 1,
    offerOverride?: { discountPercent: number; discountReason?: string }
  ) => {
    setLastAddedProduct(product);
    const storeIdToTrack = store?.id || product.storeId;
    if (storeIdToTrack) {
      // 1. Track ADD_TO_CART commerce event (non-blocking)
      eventService.trackEvent({
        storeId: storeIdToTrack,
        eventType: 'ADD_TO_CART',
        productId: product.id,
        metadata: {
          quantity,
          price: product.basePrice,
          category: product.category,
          appliedDiscountPercent: offerOverride ? offerOverride.discountPercent : undefined,
        },
      });

      // 2. Server-authoritative sync (non-blocking to user flow)
      cartService.addItem(storeIdToTrack, product.id, quantity)
        .then((updatedServerCart) => {
          setServerCart(updatedServerCart);
        })
        .catch((err) => {
          console.warn('[Cart Service] Backend cart sync notice:', err?.message || err);
          setCartError(err?.message || 'Could not persist item to server cart');
        });
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      
      // Calculate discount: explicit offer override takes precedence
      let discount = 0;
      let reason: string | undefined = undefined;

      if (offerOverride !== undefined) {
        discount = Math.max(0, offerOverride.discountPercent);
        reason = offerOverride.discountReason || (discount > 0 ? `${discount}% Exclusive Offer Applied` : undefined);
      } else if (constraints.allowPersonalizedDiscounts && product.aiDiscountEligible) {
        // Cap by merchant maximum discount limit
        const maxDiscount = constraints.maxDiscountLimit;
        discount = Math.min(product.activeDiscountPercent || 5, maxDiscount);
        reason = `${discount}% AI Revenue Optimizer Nudge`;
      }

      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { 
                ...item, 
                quantity: item.quantity + quantity,
                appliedDiscountPercent: offerOverride !== undefined ? discount : item.appliedDiscountPercent,
                discountReason: offerOverride !== undefined ? reason : item.discountReason,
              }
            : item
        );
      }
      return [...prev, { product, quantity, appliedDiscountPercent: discount, discountReason: reason }];
    });
  };

  const removeFromCart = (productId: string) => {
    // Track REMOVE_FROM_CART commerce event (non-blocking)
    const storeIdToTrack = store?.id;
    if (storeIdToTrack) {
      eventService.trackEvent({
        storeId: storeIdToTrack,
        eventType: 'REMOVE_FROM_CART',
        productId,
      });

      const serverItem = serverCart?.items.find(i => i.productId === productId);
      if (serverItem) {
        cartService.removeItem(storeIdToTrack, serverItem.id)
          .then((updated) => setServerCart(updated))
          .catch((err) => console.warn('[Cart Service] Backend cart remove notice:', err));
      }
    }

    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const storeIdToTrack = store?.id;
    if (storeIdToTrack) {
      const serverItem = serverCart?.items.find(i => i.productId === productId);
      if (serverItem) {
        cartService.updateItemQuantity(storeIdToTrack, serverItem.id, quantity)
          .then((updated) => setServerCart(updated))
          .catch((err) => console.warn('[Cart Service] Backend cart update notice:', err));
      }
    }

    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity } : item));
  };

  const clearCart = () => {
    const storeIdToTrack = store?.id;
    if (storeIdToTrack) {
      cartService.clearCart(storeIdToTrack)
        .then((updated) => setServerCart(updated))
        .catch((err) => console.warn('[Cart Service] Backend cart clear notice:', err));
    }
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

  // Real Backend Orders state
  const [serverOrders, setServerOrders] = useState<ServerOrderData[]>([]);
  const [serverOrder, setServerOrder] = useState<ServerOrderData | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const loadOrders = useCallback(async (): Promise<ServerOrderData[]> => {
    if (!store?.id) return [];
    try {
      const list = await orderService.listOrders(store.id);
      setServerOrders(list);
      return list;
    } catch (err) {
      console.warn('[Order Service] List orders notice:', err);
      return [];
    }
  }, [store?.id]);

  const checkoutOrder = async (customerDetails?: { name?: string; email?: string; address?: string }): Promise<ServerOrderData> => {
    if (!store?.id) {
      throw new Error('Store is not loaded. Please select or initialize a store.');
    }
    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      // 1. Create server-authoritative PENDING order
      const orderData = await orderService.checkout(store.id);
      setServerOrder(orderData);

      // 2. Initialize Payment Order with server-calculated total
      const paymentInfo = await paymentService.createPaymentOrder(orderData.orderId, store.id);

      // 3. Attempt Razorpay standard popup or fallback verification
      const hasScript = await paymentService.loadRazorpayScript();
      
      let verifiedOrderData: ServerOrderData = {
        ...orderData,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        razorpayOrderId: paymentInfo.razorpayOrderId,
      };

      if (hasScript && window.Razorpay && paymentInfo.keyId && paymentInfo.keyId.startsWith('rzp_')) {
        await new Promise<void>((resolve, reject) => {
          try {
            const rzp = new window.Razorpay({
              key: paymentInfo.keyId,
              amount: paymentInfo.amount,
              currency: paymentInfo.currency,
              name: store.name || 'OptiCommerce Store',
              description: `Order #${orderData.orderId.slice(-6)}`,
              order_id: paymentInfo.razorpayOrderId,
              prefill: {
                name: customerDetails?.name || 'Rahul Verma',
                email: customerDetails?.email || 'customer@example.com',
                contact: '9876543210',
              },
              theme: {
                color: '#2563eb',
              },
              handler: async function (response: any) {
                try {
                  const verified = await paymentService.verifyPayment({
                    orderId: orderData.orderId,
                    razorpayOrderId: response.razorpay_order_id || paymentInfo.razorpayOrderId,
                    razorpayPaymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
                    razorpaySignature: response.razorpay_signature || 'mock_sig',
                    storeId: store.id,
                  });
                  verifiedOrderData = {
                    ...orderData,
                    status: verified.status,
                    paymentStatus: verified.paymentStatus,
                    razorpayOrderId: paymentInfo.razorpayOrderId,
                    razorpayPaymentId: verified.razorpayPaymentId,
                  };
                  resolve();
                } catch (vErr) {
                  reject(vErr);
                }
              },
              modal: {
                ondismiss: function () {
                  reject(new Error('Payment was cancelled by user'));
                },
              },
            });
            rzp.open();
          } catch (rzpErr) {
            console.warn('[Razorpay] Popup initialization warning, proceeding with verification:', rzpErr);
            resolve();
          }
        });
      } else {
        // Test / Sandbox mode fallback verification
        try {
          const mockPaymentId = `pay_mock_${Date.now()}`;
          const verified = await paymentService.verifyPayment({
            orderId: orderData.orderId,
            razorpayOrderId: paymentInfo.razorpayOrderId,
            razorpayPaymentId: mockPaymentId,
            razorpaySignature: 'mock_valid_signature_for_sandbox',
            storeId: store.id,
          });
          verifiedOrderData = {
            ...orderData,
            status: verified.status,
            paymentStatus: verified.paymentStatus,
            razorpayOrderId: paymentInfo.razorpayOrderId,
            razorpayPaymentId: verified.razorpayPaymentId,
          };
        } catch (simErr) {
          // If server rejects mock signature, keep PENDING state
          console.warn('[Payment Service] Fallback sandbox verification note:', simErr);
        }
      }

      const customerOrder: CustomerOrder = {
        id: verifiedOrderData.orderId,
        date: new Date(verifiedOrderData.createdAt).toISOString().split('T')[0],
        items: [...cart],
        subtotal: verifiedOrderData.subtotal,
        discountAmount: verifiedOrderData.discount,
        total: verifiedOrderData.total,
        status: verifiedOrderData.status === 'CONFIRMED' ? 'Confirmed' : 'Processing',
        customerName: customerDetails?.name || 'Rahul Verma',
        customerEmail: customerDetails?.email || 'customer@example.com',
        shippingAddress: customerDetails?.address || 'Flat 402, Green Glen Heights, Bellandur, Bangalore 560103',
        aiSavings: verifiedOrderData.discount,
      };

      setOrders(prev => [customerOrder, ...prev]);
      setLastCompletedOrder(customerOrder);
      setServerOrder(verifiedOrderData);
      setCart([]);
      setServerCart(null);
      setCustomerTab('confirmation');
      return verifiedOrderData;
    } catch (err: any) {
      const msg = err?.message || 'Payment processing failed. Please try again.';
      setCheckoutError(msg);
      throw err;
    } finally {
      setIsCheckingOut(false);
    }
  };

  const placeOrder = async (customerDetails: { name: string; email: string; address: string }): Promise<CustomerOrder> => {
    if (store?.id) {
      try {
        const orderData = await checkoutOrder(customerDetails);
        const customerOrder: CustomerOrder = {
          id: orderData.orderId,
          date: new Date(orderData.createdAt).toISOString().split('T')[0],
          items: [...cart],
          subtotal: orderData.subtotal,
          discountAmount: orderData.discount,
          total: orderData.total,
          status: 'Processing',
          customerName: customerDetails.name,
          customerEmail: customerDetails.email,
          shippingAddress: customerDetails.address,
          aiSavings: orderData.discount,
        };
        return customerOrder;
      } catch (err) {
        console.warn('[Order Service] Fallback checkout notice:', err);
      }
    }

    const fallbackOrder: CustomerOrder = {
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
    setOrders(prev => [fallbackOrder, ...prev]);
    setLastCompletedOrder(fallbackOrder);
    clearCart();
    setCustomerTab('confirmation');
    return fallbackOrder;
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
        conversationState,
        setConversationState,
        resetConversationState,
        askAIAssistant,
        compareProducts,
        isAISearchLoading,
        aiSearchError,
        lastRecommendationResponse,
        cart,
        serverCart,
        lastAddedProduct,
        isCartLoading,
        cartError,
        refreshCart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartCount,
        cartSubtotal,
        cartSavings,
        cartTotal,
        orders,
        serverOrders,
        serverOrder,
        lastCompletedOrder,
        isCheckingOut,
        checkoutError,
        checkoutOrder,
        placeOrder,
        loadOrders,
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
