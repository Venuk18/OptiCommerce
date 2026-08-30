import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, AIConstraints, CartItem, CustomerOrder, SimulationContext, SimulationOutcome, AIChatTurn } from '../types';
import { INITIAL_PRODUCTS, INITIAL_AI_CONSTRAINTS, INITIAL_SIMULATION_CONTEXT, SIMULATION_SCENARIOS, DEFAULT_AI_CHAT_TURNS } from '../data/mockData';

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

  // Helper
  formatINR: (amount: number) => string;
  formatPrice: (amount: number) => string;
}

const CommerceContext = createContext<CommerceContextType | undefined>(undefined);

export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const [experience, setExperience] = useState<'merchant' | 'customer'>('customer');
  const [merchantTab, setMerchantTab] = useState<MerchantTab>('ai-control');
  const [customerTab, setCustomerTab] = useState<CustomerTab>('home');
  
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(INITIAL_PRODUCTS[0]);
  
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
    
    let matchingProducts: Product[] = [];
    let summary = '';
    let note = '';
    let followUps: string[] = [];

    if (lower.includes('white') || lower.includes('pearl')) {
      matchingProducts = [
        products.find(p => p.id === 'zenpods-white') || products[2],
        products.find(p => p.id === 'zenpods-pro') || products[0],
      ].filter(Boolean) as Product[];
      summary = "I found matching white colorways for the ZenPods series:";
      note = "ZenPods Pro in Pure White has identical acoustic drivers and 40-hour battery life in a sleek matte pearl finish.";
      followUps = [
        'Show me something with better battery life',
        'Are there any Sony options?',
        'Compare technical specs'
      ];
    } else if (lower.includes('battery') || lower.includes('endurance') || lower.includes('hour')) {
      matchingProducts = [
        products.find(p => p.id === 'aurasound-60') || products[3],
        products.find(p => p.id === 'zenpods-pro') || products[0],
      ].filter(Boolean) as Product[];
      summary = "I found long-battery endurance audio options:";
      note = "AuraSound LongPlay 60 delivers 65 hours of continuous playback—over 50% more battery life than average.";
      followUps = [
        'Are there any Sony options?',
        'I like the ZenPods, but are there any in white?',
        'Are these sweat and water resistant?'
      ];
    } else if (lower.includes('sony') || lower.includes('xb910') || lower.includes('extra bass')) {
      matchingProducts = [
        products.find(p => p.id === 'sony-xb910n') || products[4],
        products.find(p => p.id === 'bassmaster-elite') || products[1],
      ].filter(Boolean) as Product[];
      summary = "Here is the top rated Sony Extra Bass model currently in stock:";
      note = "Sony WH-XB910N features dedicated dual noise sensor ANC and signature Extra Bass acoustic tuning.";
      followUps = [
        'Show me something under ₹5,000',
        'Show me something with better battery life',
        'I like the ZenPods, but are there any in white?'
      ];
    } else if (lower.includes('camera') || lower.includes('photo') || lower.includes('night') || lower.includes('1000')) {
      matchingProducts = [
        products.find(p => p.id === 'prod-camera-night') || products[5],
        products.find(p => p.id === 'prod-charge-1') || products[0],
      ].filter(Boolean) as Product[];
      summary = "I found 2 products that match your requirements: 'Camera for night photography under $1000':";
      note = "AlphaVision NightShot Pro features a back-illuminated sensor with dual native ISO for clean low-light shots.";
      followUps = [
        'What lenses are compatible with this body?',
        'Show me wireless charging docks',
        'Compare with studio headphones'
      ];
    } else if (lower.includes('laptop') || lower.includes('creator') || lower.includes('novabook')) {
      matchingProducts = [
        products.find(p => p.id === 'prod-laptop-1') || products[6],
        products.find(p => p.id === 'prod-display-1') || products[7],
      ].filter(Boolean) as Product[];
      summary = "I found top-tier creator workstations for intensive creative workflows:";
      note = "NovaBook Pro 16 features 64GB Unified RAM and 120Hz Mini-LED Liquid Retina display.";
      followUps = [
        'Show me compatible ultrawide displays',
        'What fast chargers work with this?',
        'Show me ergonomic desk bundles'
      ];
    } else {
      // General or fallback search
      const matched = products.filter(p => 
        p.name.toLowerCase().includes(lower) || 
        p.description.toLowerCase().includes(lower) ||
        p.tags.some(t => t.toLowerCase().includes(lower)) ||
        p.category.toLowerCase().includes(lower)
      );
      matchingProducts = matched.length >= 2 ? matched.slice(0, 2) : [products[0], products[1]];
      summary = `I found 4 products that match your requirements: '${prompt}'.`;
      note = `These two are the strongest matches based on your budget and 4.8/5 average user rating for bass performance.`;
      followUps = [
        'I like the ZenPods, but are there any in white?',
        'Show me something with better battery life',
        'Are there any Sony options?'
      ];
    }

    const newTurn: AIChatTurn = {
      id: `turn-${Date.now()}`,
      userPrompt: prompt,
      assistantSummary: summary,
      highlightNote: note,
      totalFound: 4,
      recommendedProducts: matchingProducts,
      suggestedFollowUps: followUps,
    };

    setAiChatTurns(prev => [...prev, newTurn]);
    setCustomerTab('ai-assistant');
  };

  // Cart
  const [cart, setCart] = useState<CartItem[]>([
    {
      product: INITIAL_PRODUCTS[1], // Auralis ANC
      quantity: 1,
      appliedDiscountPercent: 5,
      discountReason: '5% AI Optimal Loyalty Nudge',
    },
    {
      product: INITIAL_PRODUCTS[4], // FastCharge Pro Station
      quantity: 1,
      appliedDiscountPercent: 0,
    },
    {
      product: INITIAL_PRODUCTS[5], // Lumina Task Lamp
      quantity: 1,
      appliedDiscountPercent: 0,
    }
  ]);

  // Orders
  const [orders, setOrders] = useState<CustomerOrder[]>([
    {
      id: 'ORD-8921',
      date: '2026-08-28',
      items: [
        {
          product: INITIAL_PRODUCTS[0],
          quantity: 1,
          appliedDiscountPercent: 5,
          discountReason: 'AI Creator Workstation Nudge',
        }
      ],
      subtotal: 2499,
      discountAmount: 125,
      total: 2374,
      status: 'Delivered',
      customerName: 'Sarah Jenkins',
      customerEmail: 'sarah.jenkins@example.com',
      shippingAddress: '742 Evergreen Terrace, Seattle WA 98101',
      aiSavings: 125,
    }
  ]);
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
