import { StoreStatus, ProductStatus, OrderStatus, PaymentStatus, AttributionSource, CommerceEventType } from '@prisma/client';

export interface InMemoryMerchant {
  id: string;
  name: string;
  email: string;
  passwordHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
  store?: InMemoryStore | null;
}

export interface InMemoryStore {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  description: string | null;
  status: StoreStatus;
  createdAt: Date;
  updatedAt: Date;
  merchant?: InMemoryMerchant | null;
  products?: InMemoryProduct[];
}

export interface InMemoryProduct {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  category: string;
  brand: string | null;
  price: any;
  costPrice: any;
  stock: number;
  images: string[];
  features: string[];
  specifications: any;
  tags: string[];
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryCartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
  product?: InMemoryProduct;
}

export interface InMemoryCart {
  id: string;
  sessionId: string;
  storeId: string;
  createdAt: Date;
  updatedAt: Date;
  items?: InMemoryCartItem[];
}

export interface InMemoryOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: any;
  discountPercent: number;
  discountAmount: any;
  lineTotal: any;
  attributionSource: AttributionSource;
  createdAt: Date;
  product?: InMemoryProduct;
  order?: InMemoryOrder;
}

export interface InMemoryOrder {
  id: string;
  sessionId: string;
  storeId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  subtotal: any;
  discount: any;
  total: any;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  items?: InMemoryOrderItem[];
  store?: InMemoryStore | null;
}

export interface InMemoryCommerceEvent {
  id: string;
  sessionId: string;
  storeId: string;
  productId: string | null;
  eventType: CommerceEventType;
  metadata: any;
  createdAt: Date;
}

class InMemoryDatabase {
  merchants = new Map<string, InMemoryMerchant>();
  stores = new Map<string, InMemoryStore>();
  products = new Map<string, InMemoryProduct>();
  carts = new Map<string, InMemoryCart>();
  cartItems = new Map<string, InMemoryCartItem>();
  orders = new Map<string, InMemoryOrder>();
  orderItems = new Map<string, InMemoryOrderItem>();
  events: InMemoryCommerceEvent[] = [];

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const merchantId = 'merchant-opticommerce-001';
    const storeId = 'store-opticommerce-001';

    const defaultMerchant: InMemoryMerchant = {
      id: merchantId,
      name: 'OptiCommerce Flagship Merchant',
      email: 'merchant@opticommerce.io',
      passwordHash: '$2b$10$JDjiAs6jumJe0HLZy4LFIeGrGZ7sWzcS1GU8J9rvPVALp8vuFoSCe',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.merchants.set(merchantId, defaultMerchant);

    const defaultStore: InMemoryStore = {
      id: storeId,
      merchantId: merchantId,
      name: 'OptiCommerce Flagship Electronics',
      slug: 'opticommerce-flagship-electronics',
      description: 'Flagship online electronics and smart devices storefront powered by AI margin optimization.',
      status: 'PUBLISHED' as StoreStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.stores.set(storeId, defaultStore);

    const seededProducts = [
      {
        id: 'prod-001',
        storeId,
        name: 'ZenPods Pro',
        description: 'Flagship wireless over-ear noise-canceling headphones with 40h battery life and studio acoustic drivers.',
        category: 'Audio',
        brand: 'ZenAudio',
        price: 4999,
        costPrice: 3100,
        stock: 48,
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'],
        features: ['40h Battery Life', 'Active Noise Cancellation', 'Titanium Drivers'],
        tags: ['wireless', 'anc', 'headphones', 'audio', 'bass'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-002',
        storeId,
        name: 'BassMaster Elite',
        description: 'Engineered for extreme sub-bass response and DJ monitor clarity with reinforced metal earcups.',
        category: 'Audio',
        brand: 'BassMaster',
        price: 4200,
        costPrice: 2400,
        stock: 35,
        images: ['https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80'],
        features: ['50mm Neodymium Sub-Bass', 'DJ Swivel Earcups', 'Gold Plated Jack'],
        tags: ['bass', 'dj', 'studio', 'audio', 'headphones'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-003',
        storeId,
        name: 'ZenPods Pro (Pure White)',
        description: 'Matte pearl white finish with identical punchy deep bass and 40h wireless playback.',
        category: 'Audio',
        brand: 'ZenAudio',
        price: 4999,
        costPrice: 3100,
        stock: 22,
        images: ['https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&auto=format&fit=crop&q=80'],
        features: ['Matte Pearl Finish', '40h Wireless Playback', 'Ultra-lightweight'],
        tags: ['white', 'wireless', 'anc', 'audio'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-004',
        storeId,
        name: 'AuraSound LongPlay 60',
        description: 'Ultra-long endurance headphones with 65-hour continuous playback and dual-chamber bass resonance.',
        category: 'Audio',
        brand: 'AuraSound',
        price: 3899,
        costPrice: 2200,
        stock: 8,
        images: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80'],
        features: ['65 Hours Continuous Playback', 'Quick Charge 10min=8h', 'Dual-chamber Bass'],
        tags: ['battery', 'endurance', 'wireless', 'audio'],
        status: 'LOW_STOCK' as ProductStatus,
      },
      {
        id: 'prod-005',
        storeId,
        name: 'Sony WH-XB910N Extra Bass',
        description: 'Club-like bass with digital noise cancelling and 30-hour battery life with quick charging.',
        category: 'Audio',
        brand: 'Sony',
        price: 8990,
        costPrice: 6200,
        stock: 18,
        images: ['https://images.unsplash.com/photo-1545127398-14699f92334b?w=800&auto=format&fit=crop&q=80'],
        features: ['EXTRA BASS Sound', 'Dual Noise Sensor ANC', 'Multipoint Connection'],
        tags: ['sony', 'anc', 'extra bass', 'audio', 'headphones'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-006',
        storeId,
        name: 'AlphaVision NightShot Pro Mirrorless',
        description: 'Back-illuminated full-frame sensor with dual native ISO for ultra low-noise astro and night photography.',
        category: 'Electronics',
        brand: 'AlphaVision',
        price: 74999,
        costPrice: 51000,
        stock: 4,
        images: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80'],
        features: ['24.2MP BSI Full-Frame', 'Dual Native ISO', '5-Axis Sensor Stabilization'],
        tags: ['camera', 'mirrorless', 'night', 'electronics', '4k'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-007',
        storeId,
        name: 'NovaBook Pro 16" Creator Edition',
        description: 'Ultra-fast M3 processor, 64GB RAM, perfect for 8K video editing and heavy rendering tasks.',
        category: 'Electronics',
        brand: 'NovaBook',
        price: 199999,
        costPrice: 132000,
        stock: 12,
        images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80'],
        features: ['16-Core M3 Max Processor', '64GB Unified RAM', 'Liquid Retina XDR Display'],
        tags: ['laptop', 'workstation', 'creator', 'electronics'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-008',
        storeId,
        name: 'Galaxy Prime 5G Smartphone',
        description: 'Flagship 6.7-inch AMOLED 120Hz display with 50MP OIS triple camera and 5000mAh battery.',
        category: 'Mobile',
        brand: 'Samsung',
        price: 49999,
        costPrice: 38000,
        stock: 25,
        images: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80'],
        features: ['6.7" AMOLED 120Hz', '50MP OIS Triple Camera', '5000mAh Super Fast Charge'],
        tags: ['mobile', 'smartphone', 'phone', '5g', 'galaxy'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-009',
        storeId,
        name: 'UltraClear Tempered Screen Protector',
        description: '9H hardness ultra-clear tempered glass with oleophobic anti-fingerprint coating.',
        category: 'Accessories',
        brand: 'ArmorShield',
        price: 499,
        costPrice: 120,
        stock: 150,
        images: ['https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800&auto=format&fit=crop&q=80'],
        features: ['9H Hardness Tempered Glass', 'Oleophobic Coating', 'Edge-to-Edge Fit'],
        tags: ['screen protector', 'tempered glass', 'protection', 'phone', 'guard'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-010',
        storeId,
        name: 'ArmorShield Shockproof Phone Case',
        description: 'Military-grade drop-tested protective bumper case with raised camera bezel.',
        category: 'Accessories',
        brand: 'ArmorShield',
        price: 799,
        costPrice: 220,
        stock: 110,
        images: ['https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80'],
        features: ['Military-Grade Drop Protection', 'Raised Camera Lip', 'Tactile Grip'],
        tags: ['phone case', 'protective case', 'mobile cover', 'protection', 'phone'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-011',
        storeId,
        name: 'TurboCharge 65W GaN Fast Charger',
        description: 'Ultra-compact 65W GaN fast wall charger with dual USB-C Power Delivery ports.',
        category: 'Accessories',
        brand: 'TurboCharge',
        price: 1299,
        costPrice: 550,
        stock: 75,
        images: ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80'],
        features: ['65W GaN Power Delivery', 'Dual USB-C Output', 'Smart Temperature Guard'],
        tags: ['charger', 'fast charger', 'gan', 'usb-c', 'power adapter'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-012',
        storeId,
        name: 'GlidePro Wireless Precision Mouse',
        description: 'Ergonomic 4000 DPI multi-surface optical mouse with silent clicks and 70-day battery.',
        category: 'Accessories',
        brand: 'GlidePro',
        price: 1499,
        costPrice: 650,
        stock: 45,
        images: ['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80'],
        features: ['4000 DPI Darkfield Sensor', 'Dual Bluetooth & 2.4GHz', 'Silent Clicks'],
        tags: ['mouse', 'wireless mouse', 'ergonomic', 'laptop', 'computer'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-013',
        storeId,
        name: 'NovaShield 16" Waterproof Laptop Sleeve',
        description: 'Padded waterproof neoprene laptop sleeve with shock-absorbing foam padding.',
        category: 'Accessories',
        brand: 'NovaShield',
        price: 1899,
        costPrice: 750,
        stock: 35,
        images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80'],
        features: ['360° Shock Absorption', 'Water-Resistant Fabric', 'Accessory Pocket'],
        tags: ['laptop bag', 'laptop sleeve', 'carrying case', 'protection', 'laptop'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-014',
        storeId,
        name: 'OmniPort 7-in-1 USB-C Hub',
        description: 'Expands single USB-C port to 4K HDMI, 100W PD charging, 3x USB 3.0, and SD reader.',
        category: 'Accessories',
        brand: 'OmniPort',
        price: 2499,
        costPrice: 1100,
        stock: 50,
        images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80'],
        features: ['4K @ 60Hz HDMI Output', '100W Pass-Through PD', '3x SuperSpeed USB 3.0'],
        tags: ['usb hub', 'usb-c hub', 'docking station', 'adapter', 'laptop'],
        status: 'PUBLISHED' as ProductStatus,
      },
      {
        id: 'prod-015',
        storeId,
        name: 'ZenPods Silicone Armor Protective Case',
        description: 'Soft-touch silicone case with carabiner clip to protect wireless earbuds from drops.',
        category: 'Accessories',
        brand: 'ZenAudio',
        price: 399,
        costPrice: 90,
        stock: 80,
        images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
        features: ['Impact-Resistant Silicone', 'Carabiner Clip Included', 'Visible LED Indicator'],
        tags: ['protective case', 'earbuds case', 'silicone case', 'audio', 'earbuds'],
        status: 'PUBLISHED' as ProductStatus,
      },
    ];

    for (const p of seededProducts) {
      this.products.set(p.id, {
        ...p,
        specifications: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Seed sample orders & attribution
    const orderId1 = 'order-demo-001';
    const sampleOrder1: InMemoryOrder = {
      id: orderId1,
      sessionId: 'sess-demo-001',
      storeId,
      status: 'CONFIRMED' as OrderStatus,
      paymentStatus: 'PAID' as PaymentStatus,
      razorpayOrderId: 'order_demo_101',
      razorpayPaymentId: 'pay_demo_101',
      subtotal: 9199,
      discount: 460,
      total: 8739,
      currency: 'INR',
      createdAt: new Date(Date.now() - 3600 * 1000 * 4),
      updatedAt: new Date(),
    };
    this.orders.set(orderId1, sampleOrder1);

    const orderItem1: InMemoryOrderItem = {
      id: 'item-demo-001',
      orderId: orderId1,
      productId: 'prod-001',
      productName: 'ZenPods Pro',
      quantity: 1,
      unitPrice: 4999,
      discountPercent: 5,
      discountAmount: 250,
      lineTotal: 4749,
      attributionSource: 'AI_CHAT' as AttributionSource,
      createdAt: new Date(),
    };
    const orderItem2: InMemoryOrderItem = {
      id: 'item-demo-002',
      orderId: orderId1,
      productId: 'prod-002',
      productName: 'BassMaster Elite',
      quantity: 1,
      unitPrice: 4200,
      discountPercent: 5,
      discountAmount: 210,
      lineTotal: 3990,
      attributionSource: 'BUNDLE' as AttributionSource,
      createdAt: new Date(),
    };
    this.orderItems.set(orderItem1.id, orderItem1);
    this.orderItems.set(orderItem2.id, orderItem2);

    // Initial baseline events
    this.events.push(
      {
        id: 'evt-001',
        sessionId: 'sess-demo-001',
        storeId,
        productId: 'prod-001',
        eventType: 'OFFER_VIEW' as CommerceEventType,
        metadata: { source: 'bundle_modal' },
        createdAt: new Date(Date.now() - 3600 * 1000 * 5),
      },
      {
        id: 'evt-002',
        sessionId: 'sess-demo-001',
        storeId,
        productId: 'prod-001',
        eventType: 'OFFER_ACCEPTED' as CommerceEventType,
        metadata: { source: 'bundle_modal', discountPercent: 5 },
        createdAt: new Date(Date.now() - 3600 * 1000 * 4),
      },
      {
        id: 'evt-003',
        sessionId: 'sess-demo-001',
        storeId,
        productId: null,
        eventType: 'PURCHASE' as CommerceEventType,
        metadata: { orderId: orderId1, bundleRevenue: 3990, recoveredSales: 0 },
        createdAt: new Date(Date.now() - 3600 * 1000 * 4),
      }
    );
  }
}

export const inMemoryDb = new InMemoryDatabase();

function matchesFilter(val: any, filter: any): boolean {
  if (filter === undefined) return true;
  if (filter === null) return val === null;

  if (typeof filter === 'object' && !(filter instanceof Date)) {
    if (Array.isArray(filter.in)) {
      if (!filter.in.includes(val)) return false;
    }
    if (Array.isArray(filter.notIn)) {
      if (filter.notIn.includes(val)) return false;
    }
    if (filter.equals !== undefined) {
      if (val !== filter.equals) return false;
    }
    if (filter.not !== undefined) {
      if (val === filter.not) return false;
    }
    if (filter.gte !== undefined) {
      const v = val instanceof Date ? val.getTime() : typeof val === 'string' && !isNaN(Date.parse(val)) ? new Date(val).getTime() : Number(val);
      const f = filter.gte instanceof Date ? filter.gte.getTime() : typeof filter.gte === 'string' && !isNaN(Date.parse(filter.gte)) ? new Date(filter.gte).getTime() : Number(filter.gte);
      if (v < f) return false;
    }
    if (filter.gt !== undefined) {
      const v = val instanceof Date ? val.getTime() : typeof val === 'string' && !isNaN(Date.parse(val)) ? new Date(val).getTime() : Number(val);
      const f = filter.gt instanceof Date ? filter.gt.getTime() : typeof filter.gt === 'string' && !isNaN(Date.parse(filter.gt)) ? new Date(filter.gt).getTime() : Number(filter.gt);
      if (v <= f) return false;
    }
    if (filter.lte !== undefined) {
      const v = val instanceof Date ? val.getTime() : typeof val === 'string' && !isNaN(Date.parse(val)) ? new Date(val).getTime() : Number(val);
      const f = filter.lte instanceof Date ? filter.lte.getTime() : typeof filter.lte === 'string' && !isNaN(Date.parse(filter.lte)) ? new Date(filter.lte).getTime() : Number(filter.lte);
      if (v > f) return false;
    }
    if (filter.lt !== undefined) {
      const v = val instanceof Date ? val.getTime() : typeof val === 'string' && !isNaN(Date.parse(val)) ? new Date(val).getTime() : Number(val);
      const f = filter.lt instanceof Date ? filter.lt.getTime() : typeof filter.lt === 'string' && !isNaN(Date.parse(filter.lt)) ? new Date(filter.lt).getTime() : Number(filter.lt);
      if (v >= f) return false;
    }
    if (filter.contains !== undefined) {
      const strVal = String(val || '').toLowerCase();
      const strSub = String(filter.contains).toLowerCase();
      if (!strVal.includes(strSub)) return false;
    }
    return true;
  }

  if (val instanceof Date && filter instanceof Date) {
    return val.getTime() === filter.getTime();
  }
  return val === filter;
}

function applySelect(obj: any, select: any) {
  if (!select) return { ...obj };
  const res: any = {};
  for (const key of Object.keys(select)) {
    if (select[key]) {
      res[key] = obj[key];
    }
  }
  return res;
}

function applyUpdateData(existing: any, data: any): any {
  const result = { ...existing };
  for (const [key, val] of Object.entries(data)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      if ('decrement' in (val as any) && typeof (val as any).decrement === 'number') {
        result[key] = (Number(existing[key]) || 0) - (val as any).decrement;
        continue;
      }
      if ('increment' in (val as any) && typeof (val as any).increment === 'number') {
        result[key] = (Number(existing[key]) || 0) + (val as any).increment;
        continue;
      }
      if ('set' in (val as any)) {
        result[key] = (val as any).set;
        continue;
      }
    }
    result[key] = val;
  }
  return result;
}

export function createInMemoryPrismaProxy() {
  return {
    merchant: {
      findUnique: async (args: { where: { id?: string; email?: string }; include?: any }) => {
        for (const m of inMemoryDb.merchants.values()) {
          if ((args.where.id && m.id === args.where.id) || (args.where.email && m.email === args.where.email)) {
            const result = { ...m };
            if (args.include?.store) {
              result.store = Array.from(inMemoryDb.stores.values()).find((s) => s.merchantId === m.id) || null;
            }
            return result;
          }
        }
        return null;
      },
      findFirst: async (args?: { include?: any }) => {
        const first = Array.from(inMemoryDb.merchants.values())[0] || null;
        if (!first) return null;
        const result = { ...first };
        if (args?.include?.store) {
          result.store = Array.from(inMemoryDb.stores.values()).find((s) => s.merchantId === first.id) || null;
        }
        return result;
      },
      findMany: async (args?: { where?: any; include?: any }) => {
        const results = [];
        for (const m of inMemoryDb.merchants.values()) {
          const result = { ...m };
          if (args?.include?.store) {
            result.store = Array.from(inMemoryDb.stores.values()).find((s) => s.merchantId === m.id) || null;
          }
          results.push(result);
        }
        return results;
      },
      create: async (args: { data: any; include?: any }) => {
        const id = args.data.id || `merchant-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const merchant: InMemoryMerchant = {
          id,
          name: args.data.name,
          email: args.data.email,
          passwordHash: args.data.passwordHash || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryDb.merchants.set(id, merchant);

        if (args.data.store?.create) {
          const storeData = args.data.store.create;
          const storeId = storeData.id || `store-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const store: InMemoryStore = {
            id: storeId,
            merchantId: id,
            name: storeData.name,
            slug: storeData.slug,
            description: storeData.description || null,
            status: storeData.status || ('PUBLISHED' as StoreStatus),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemoryDb.stores.set(storeId, store);
          merchant.store = store;
        }

        const result = { ...merchant };
        if (args.include?.store) {
          result.store = Array.from(inMemoryDb.stores.values()).find((s) => s.merchantId === id) || null;
        }
        return result;
      },
      update: async (args: { where: { id: string }; data: any }) => {
        const m = inMemoryDb.merchants.get(args.where.id);
        if (!m) throw new Error('Record not found');
        const updated = { ...m, ...args.data, updatedAt: new Date() };
        inMemoryDb.merchants.set(args.where.id, updated);
        return updated;
      },
      count: async () => inMemoryDb.merchants.size,
    },

    store: {
      findUnique: async (args: { where: { id?: string; slug?: string; merchantId?: string }; include?: any; select?: any }) => {
        for (const s of inMemoryDb.stores.values()) {
          const match =
            (args.where.id && s.id === args.where.id) ||
            (args.where.slug && s.slug === args.where.slug) ||
            (args.where.merchantId && s.merchantId === args.where.merchantId);
          if (match) {
            const result: any = { ...s };
            if (args.include?.merchant) {
              result.merchant = inMemoryDb.merchants.get(s.merchantId) || null;
            }
            if (args.include?.products) {
              result.products = Array.from(inMemoryDb.products.values()).filter((p) => p.storeId === s.id);
            }
            return applySelect(result, args.select);
          }
        }
        return null;
      },
      findFirst: async (args?: { where?: any; include?: any; select?: any }) => {
        for (const s of inMemoryDb.stores.values()) {
          let match = true;
          if (args?.where) {
            for (const [k, v] of Object.entries(args.where)) {
              if (!matchesFilter((s as any)[k], v)) match = false;
            }
          }
          if (match) {
            const result: any = { ...s };
            if (args?.include?.merchant) {
              result.merchant = inMemoryDb.merchants.get(s.merchantId) || null;
            }
            if (args?.include?.products) {
              result.products = Array.from(inMemoryDb.products.values()).filter((p) => p.storeId === s.id);
            }
            return applySelect(result, args?.select);
          }
        }
        return null;
      },
      findMany: async () => Array.from(inMemoryDb.stores.values()),
      create: async (args: { data: any; include?: any }) => {
        const id = args.data.id || `store-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const store: InMemoryStore = {
          id,
          merchantId: args.data.merchantId,
          name: args.data.name,
          slug: args.data.slug,
          description: args.data.description || null,
          status: args.data.status || ('UNPUBLISHED' as StoreStatus),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryDb.stores.set(id, store);
        const result = { ...store };
        if (args.include?.merchant) {
          result.merchant = inMemoryDb.merchants.get(store.merchantId) || null;
        }
        return result;
      },
      update: async (args: { where: { id: string }; data: any }) => {
        const s = inMemoryDb.stores.get(args.where.id);
        if (!s) throw new Error('Store not found');
        const updated = { ...s, ...args.data, updatedAt: new Date() };
        inMemoryDb.stores.set(args.where.id, updated);
        return updated;
      },
      count: async () => inMemoryDb.stores.size,
    },

    product: {
      findUnique: async (args: { where: { id: string }; include?: any; select?: any }) => {
        const p = inMemoryDb.products.get(args.where.id);
        if (!p) return null;
        const result: any = { ...p };
        if (args.include?.store) {
          result.store = inMemoryDb.stores.get(p.storeId) || null;
        }
        return applySelect(result, args.select);
      },
      findFirst: async (args?: { where?: any }) => {
        for (const p of inMemoryDb.products.values()) {
          let match = true;
          if (args?.where) {
            for (const [k, v] of Object.entries(args.where)) {
              if (!matchesFilter((p as any)[k], v)) match = false;
            }
          }
          if (match) return { ...p };
        }
        return null;
      },
      findMany: async (args?: { where?: any; orderBy?: any; take?: number; skip?: number; select?: any }) => {
        let list = Array.from(inMemoryDb.products.values());
        if (args?.where) {
          list = list.filter((p) => {
            for (const [k, v] of Object.entries(args.where)) {
              if (!matchesFilter((p as any)[k], v)) return false;
            }
            return true;
          });
        }
        if (args?.orderBy?.createdAt === 'desc') {
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (args?.skip) list = list.slice(args.skip);
        if (args?.take) list = list.slice(0, args.take);
        return list.map((p) => applySelect(p, args?.select));
      },
      create: async (args: { data: any }) => {
        const id = args.data.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const product: InMemoryProduct = {
          id,
          storeId: args.data.storeId,
          name: args.data.name,
          description: args.data.description || null,
          category: args.data.category,
          brand: args.data.brand || null,
          price: Number(args.data.price),
          costPrice: Number(args.data.costPrice),
          stock: args.data.stock !== undefined ? Number(args.data.stock) : 0,
          images: Array.isArray(args.data.images) ? args.data.images : [],
          features: Array.isArray(args.data.features) ? args.data.features : [],
          specifications: args.data.specifications || {},
          tags: Array.isArray(args.data.tags) ? args.data.tags : [],
          status: args.data.status || ('DRAFT' as ProductStatus),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryDb.products.set(id, product);
        return { ...product };
      },
      createMany: async (args: { data: any[] }) => {
        let count = 0;
        for (const item of args.data) {
          const id = item.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          inMemoryDb.products.set(id, {
            id,
            storeId: item.storeId,
            name: item.name,
            description: item.description || null,
            category: item.category,
            brand: item.brand || null,
            price: Number(item.price),
            costPrice: Number(item.costPrice),
            stock: item.stock !== undefined ? Number(item.stock) : 0,
            images: Array.isArray(item.images) ? item.images : [],
            features: Array.isArray(item.features) ? item.features : [],
            specifications: item.specifications || {},
            tags: Array.isArray(item.tags) ? item.tags : [],
            status: item.status || ('DRAFT' as ProductStatus),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          count++;
        }
        return { count };
      },
      update: async (args: { where: { id: string }; data: any }) => {
        const p = inMemoryDb.products.get(args.where.id);
        if (!p) throw new Error('Product not found');
        const updated = applyUpdateData(p, { ...args.data, updatedAt: new Date() });
        inMemoryDb.products.set(args.where.id, updated);
        return { ...updated };
      },
      updateMany: async (args: { where: any; data: any }) => {
        let count = 0;
        for (const [id, p] of inMemoryDb.products.entries()) {
          let match = true;
          for (const [k, v] of Object.entries(args.where)) {
            if (!matchesFilter((p as any)[k], v)) match = false;
          }
          if (match) {
            const updated = applyUpdateData(p, { ...args.data, updatedAt: new Date() });
            inMemoryDb.products.set(id, updated);
            count++;
          }
        }
        return { count };
      },
      delete: async (args: { where: { id: string } }) => {
        const p = inMemoryDb.products.get(args.where.id);
        if (p) inMemoryDb.products.delete(args.where.id);
        return p;
      },
      count: async (args?: { where?: any }) => {
        if (!args?.where) return inMemoryDb.products.size;
        let count = 0;
        for (const p of inMemoryDb.products.values()) {
          let match = true;
          for (const [k, v] of Object.entries(args.where)) {
            if (!matchesFilter((p as any)[k], v)) match = false;
          }
          if (match) count++;
        }
        return count;
      },
    },

    cart: {
      findUnique: async (args: {
        where: { id?: string; sessionId_storeId?: { sessionId: string; storeId: string } };
        include?: any;
      }) => {
        let target: InMemoryCart | null = null;
        if (args.where.id) {
          target = inMemoryDb.carts.get(args.where.id) || null;
        } else if (args.where.sessionId_storeId) {
          const { sessionId, storeId } = args.where.sessionId_storeId;
          target =
            Array.from(inMemoryDb.carts.values()).find(
              (c) => c.sessionId === sessionId && c.storeId === storeId
            ) || null;
        }
        if (!target) return null;

        const result = { ...target };
        if (args.include?.items) {
          const items = Array.from(inMemoryDb.cartItems.values()).filter((item) => item.cartId === target!.id);
          result.items = items.map((item) => {
            const itemCopy = { ...item };
            if (args.include?.items?.include?.product) {
              itemCopy.product = inMemoryDb.products.get(item.productId);
            }
            return itemCopy;
          });
        }
        return result;
      },
      findFirst: async (args: { where: { sessionId: string; storeId: string }; include?: any }) => {
        const target =
          Array.from(inMemoryDb.carts.values()).find(
            (c) => c.sessionId === args.where.sessionId && c.storeId === args.where.storeId
          ) || null;
        if (!target) return null;
        const result = { ...target };
        if (args.include?.items) {
          const items = Array.from(inMemoryDb.cartItems.values()).filter((item) => item.cartId === target.id);
          result.items = items.map((item) => {
            const itemCopy = { ...item };
            if (args.include?.items?.include?.product) {
              itemCopy.product = inMemoryDb.products.get(item.productId);
            }
            return itemCopy;
          });
        }
        return result;
      },
      create: async (args: { data: any; include?: any }) => {
        const id = args.data.id || `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const cart: InMemoryCart = {
          id,
          sessionId: args.data.sessionId,
          storeId: args.data.storeId,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        };
        inMemoryDb.carts.set(id, cart);
        return { ...cart };
      },
      upsert: async (args: {
        where: { id?: string; sessionId_storeId?: { sessionId: string; storeId: string } };
        create: any;
        update: any;
      }) => {
        let target: InMemoryCart | null = null;
        if (args.where.id) {
          target = inMemoryDb.carts.get(args.where.id) || null;
        } else if (args.where.sessionId_storeId) {
          const { sessionId, storeId } = args.where.sessionId_storeId;
          target =
            Array.from(inMemoryDb.carts.values()).find(
              (c) => c.sessionId === sessionId && c.storeId === storeId
            ) || null;
        }
        if (target) {
          const updated = { ...target, ...args.update, updatedAt: new Date() };
          inMemoryDb.carts.set(target.id, updated);
          return { ...updated };
        } else {
          const id = args.create.id || `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const cart: InMemoryCart = {
            id,
            sessionId: args.create.sessionId,
            storeId: args.create.storeId,
            createdAt: new Date(),
            updatedAt: new Date(),
            items: [],
          };
          inMemoryDb.carts.set(id, cart);
          return { ...cart };
        }
      },
      update: async (args: { where: { id: string }; data: any; include?: any }) => {
        const c = inMemoryDb.carts.get(args.where.id);
        if (!c) throw new Error('Cart not found');
        const updated = { ...c, ...args.data, updatedAt: new Date() };
        inMemoryDb.carts.set(args.where.id, updated);
        return { ...updated };
      },
      delete: async (args: { where: { id: string } }) => {
        const c = inMemoryDb.carts.get(args.where.id);
        if (c) inMemoryDb.carts.delete(args.where.id);
        return c;
      },
    },

    cartItem: {
      findUnique: async (args: {
        where: { id?: string; cartId_productId?: { cartId: string; productId: string } };
        include?: any;
      }) => {
        let target: InMemoryCartItem | null = null;
        if (args.where.id) {
          target = inMemoryDb.cartItems.get(args.where.id) || null;
        } else if (args.where.cartId_productId) {
          const { cartId, productId } = args.where.cartId_productId;
          target =
            Array.from(inMemoryDb.cartItems.values()).find(
              (item) => item.cartId === cartId && item.productId === productId
            ) || null;
        }
        if (!target) return null;
        const result = { ...target };
        if (args.include?.product) {
          result.product = inMemoryDb.products.get(target.productId);
        }
        return result;
      },
      findMany: async (args?: { where?: any }) => {
        let items = Array.from(inMemoryDb.cartItems.values());
        if (args?.where?.cartId) {
          items = items.filter((item) => item.cartId === args.where.cartId);
        }
        return items.map((item) => ({ ...item }));
      },
      create: async (args: { data: any; include?: any }) => {
        const id = args.data.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const item: InMemoryCartItem = {
          id,
          cartId: args.data.cartId,
          productId: args.data.productId,
          quantity: args.data.quantity || 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryDb.cartItems.set(id, item);
        const result = { ...item };
        if (args.include?.product) {
          result.product = inMemoryDb.products.get(item.productId);
        }
        return result;
      },
      update: async (args: { where: { id: string }; data: any; include?: any }) => {
        const item = inMemoryDb.cartItems.get(args.where.id);
        if (!item) throw new Error('CartItem not found');
        const updated = { ...item, ...args.data, updatedAt: new Date() };
        inMemoryDb.cartItems.set(args.where.id, updated);
        const result = { ...updated };
        if (args.include?.product) {
          result.product = inMemoryDb.products.get(item.productId);
        }
        return result;
      },
      delete: async (args: { where: { id: string } }) => {
        const item = inMemoryDb.cartItems.get(args.where.id);
        if (item) inMemoryDb.cartItems.delete(args.where.id);
        return item;
      },
      deleteMany: async (args: { where: { cartId: string } }) => {
        let count = 0;
        for (const [id, item] of inMemoryDb.cartItems.entries()) {
          if (item.cartId === args.where.cartId) {
            inMemoryDb.cartItems.delete(id);
            count++;
          }
        }
        return { count };
      },
    },

    order: {
      findUnique: async (args: {
        where: { id?: string; razorpayOrderId?: string };
        include?: any;
      }) => {
        let target: InMemoryOrder | null = null;
        if (args.where.id) {
          target = inMemoryDb.orders.get(args.where.id) || null;
        } else if (args.where.razorpayOrderId) {
          target =
            Array.from(inMemoryDb.orders.values()).find(
              (o) => o.razorpayOrderId === args.where.razorpayOrderId
            ) || null;
        }
        if (!target) return null;
        const result = { ...target };
        if (args.include?.items) {
          const items = Array.from(inMemoryDb.orderItems.values()).filter((item) => item.orderId === target!.id);
          result.items = items.map((item) => {
            const itemCopy = { ...item };
            if (args.include?.items?.include?.product) {
              itemCopy.product = inMemoryDb.products.get(item.productId);
            }
            return itemCopy;
          });
        }
        if (args.include?.store) {
          result.store = inMemoryDb.stores.get(target!.storeId) || null;
        }
        return result;
      },
      findMany: async (args?: { where?: any; include?: any; orderBy?: any; select?: any }) => {
        let orders = Array.from(inMemoryDb.orders.values());
        if (args?.where) {
          orders = orders.filter((o) => {
            for (const [k, v] of Object.entries(args.where)) {
              if (!matchesFilter((o as any)[k], v)) return false;
            }
            return true;
          });
        }
        if (args?.orderBy?.createdAt === 'desc') {
          orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return orders.map((o) => {
          const res = { ...o };
          if (args?.include?.items) {
            const items = Array.from(inMemoryDb.orderItems.values()).filter((item) => item.orderId === o.id);
            res.items = items.map((item) => ({
              ...item,
              product: args.include?.items?.include?.product ? inMemoryDb.products.get(item.productId) : undefined,
            }));
          }
          if (args?.include?.store) {
            res.store = inMemoryDb.stores.get(o.storeId) || null;
          }
          return applySelect(res, args?.select);
        });
      },
      create: async (args: { data: any; include?: any }) => {
        const id = args.data.id || `order-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const order: InMemoryOrder = {
          id,
          sessionId: args.data.sessionId,
          storeId: args.data.storeId,
          status: args.data.status || ('PENDING' as OrderStatus),
          paymentStatus: args.data.paymentStatus || ('CREATED' as PaymentStatus),
          razorpayOrderId: args.data.razorpayOrderId || null,
          razorpayPaymentId: args.data.razorpayPaymentId || null,
          subtotal: Number(args.data.subtotal),
          discount: Number(args.data.discount || 0),
          total: Number(args.data.total),
          currency: args.data.currency || 'INR',
          createdAt: args.data.createdAt instanceof Date ? args.data.createdAt : args.data.createdAt ? new Date(args.data.createdAt) : new Date(),
          updatedAt: new Date(),
          items: [],
        };
        inMemoryDb.orders.set(id, order);

        if (args.data.items?.create) {
          const createItems = Array.isArray(args.data.items.create)
            ? args.data.items.create
            : [args.data.items.create];
          for (const itemData of createItems) {
            const itemId = `orderitem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const orderItem: InMemoryOrderItem = {
              id: itemId,
              orderId: id,
              productId: itemData.productId,
              productName: itemData.productName,
              quantity: itemData.quantity || 1,
              unitPrice: Number(itemData.unitPrice),
              discountPercent: Number(itemData.discountPercent || 0),
              discountAmount: Number(itemData.discountAmount || 0),
              lineTotal: Number(itemData.lineTotal),
              attributionSource: itemData.attributionSource || ('DIRECT' as AttributionSource),
              createdAt: itemData.createdAt instanceof Date ? itemData.createdAt : itemData.createdAt ? new Date(itemData.createdAt) : new Date(),
            };
            inMemoryDb.orderItems.set(itemId, orderItem);
          }
        }

        const result = { ...order };
        if (args.include?.items) {
          result.items = Array.from(inMemoryDb.orderItems.values()).filter((item) => item.orderId === id);
        }
        return result;
      },
      update: async (args: { where: { id: string }; data: any; include?: any }) => {
        const o = inMemoryDb.orders.get(args.where.id);
        if (!o) throw new Error('Order not found');
        const updated = { ...o, ...args.data, updatedAt: new Date() };
        inMemoryDb.orders.set(args.where.id, updated);
        const result = { ...updated };
        if (args.include?.items) {
          result.items = Array.from(inMemoryDb.orderItems.values()).filter((item) => item.orderId === o.id);
        }
        return result;
      },
      count: async (args?: { where?: any }) => {
        if (!args?.where) return inMemoryDb.orders.size;
        let count = 0;
        for (const o of inMemoryDb.orders.values()) {
          let match = true;
          for (const [k, v] of Object.entries(args.where)) {
            if (!matchesFilter((o as any)[k], v)) match = false;
          }
          if (match) count++;
        }
        return count;
      },
    },

    orderItem: {
      findMany: async (args?: { where?: any; select?: any }) => {
        let items = Array.from(inMemoryDb.orderItems.values());
        if (args?.where) {
          items = items.filter((item) => {
            if (args.where.order) {
              const order = inMemoryDb.orders.get(item.orderId);
              if (!order) return false;
              for (const [k, v] of Object.entries(args.where.order)) {
                if (!matchesFilter((order as any)[k], v)) return false;
              }
            }
            for (const [k, v] of Object.entries(args.where)) {
              if (k === 'order') continue;
              if (!matchesFilter((item as any)[k], v)) return false;
            }
            return true;
          });
        }
        return items.map((i) => applySelect(i, args?.select));
      },
      create: async (args: { data: any }) => {
        const id = args.data.id || `orderitem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const orderItem: InMemoryOrderItem = {
          id,
          orderId: args.data.orderId,
          productId: args.data.productId,
          productName: args.data.productName,
          quantity: args.data.quantity || 1,
          unitPrice: Number(args.data.unitPrice),
          discountPercent: Number(args.data.discountPercent || 0),
          discountAmount: Number(args.data.discountAmount || 0),
          lineTotal: Number(args.data.lineTotal),
          attributionSource: args.data.attributionSource || ('DIRECT' as AttributionSource),
          createdAt: args.data.createdAt instanceof Date ? args.data.createdAt : args.data.createdAt ? new Date(args.data.createdAt) : new Date(),
        };
        inMemoryDb.orderItems.set(id, orderItem);
        return { ...orderItem };
      },
      createMany: async (args: { data: any[] }) => {
        let count = 0;
        for (const itemData of args.data) {
          const id = itemData.id || `orderitem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const orderItem: InMemoryOrderItem = {
            id,
            orderId: itemData.orderId,
            productId: itemData.productId,
            productName: itemData.productName,
            quantity: itemData.quantity || 1,
            unitPrice: Number(itemData.unitPrice),
            discountPercent: Number(itemData.discountPercent || 0),
            discountAmount: Number(itemData.discountAmount || 0),
            lineTotal: Number(itemData.lineTotal),
            attributionSource: itemData.attributionSource || ('DIRECT' as AttributionSource),
            createdAt: itemData.createdAt instanceof Date ? itemData.createdAt : itemData.createdAt ? new Date(itemData.createdAt) : new Date(),
          };
          inMemoryDb.orderItems.set(id, orderItem);
          count++;
        }
        return { count };
      },
    },

    commerceEvent: {
      findFirst: async (args?: { where?: any; orderBy?: any; select?: any }) => {
        let list = [...inMemoryDb.events];
        if (args?.where) {
          list = list.filter((e) => {
            for (const [k, v] of Object.entries(args.where)) {
              if (!matchesFilter((e as any)[k], v)) return false;
            }
            return true;
          });
        }
        if (args?.orderBy?.createdAt === 'desc') {
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else if (args?.orderBy?.createdAt === 'asc') {
          list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        if (list.length === 0) return null;
        return applySelect(list[0], args?.select);
      },
      create: async (args: { data: any }) => {
        const id = args.data.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const createdAt =
          args.data.createdAt instanceof Date
            ? args.data.createdAt
            : args.data.createdAt
            ? new Date(args.data.createdAt)
            : new Date();
        const event: InMemoryCommerceEvent = {
          id,
          sessionId: args.data.sessionId,
          storeId: args.data.storeId,
          productId: args.data.productId || null,
          eventType: args.data.eventType,
          metadata: args.data.metadata || null,
          createdAt,
        };
        inMemoryDb.events.push(event);
        return { ...event };
      },
      createMany: async (args: { data: any[] }) => {
        let count = 0;
        for (const item of args.data) {
          const id = item.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const createdAt =
            item.createdAt instanceof Date
              ? item.createdAt
              : item.createdAt
              ? new Date(item.createdAt)
              : new Date();
          inMemoryDb.events.push({
            id,
            sessionId: item.sessionId,
            storeId: item.storeId,
            productId: item.productId || null,
            eventType: item.eventType,
            metadata: item.metadata || null,
            createdAt,
          });
          count++;
        }
        return { count };
      },
      findMany: async (args?: { where?: any; orderBy?: any; take?: number; select?: any }) => {
        let list = [...inMemoryDb.events];
        if (args?.where) {
          list = list.filter((e) => {
            for (const [k, v] of Object.entries(args.where)) {
              if (!matchesFilter((e as any)[k], v)) return false;
            }
            return true;
          });
        }
        if (args?.orderBy?.createdAt === 'desc') {
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else if (args?.orderBy?.createdAt === 'asc') {
          list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        if (args?.take) {
          list = list.slice(0, args.take);
        }
        return list.map((e) => applySelect(e, args?.select));
      },
      count: async (args?: { where?: any }) => {
        if (!args?.where) return inMemoryDb.events.length;
        let count = 0;
        for (const e of inMemoryDb.events) {
          let match = true;
          for (const [k, v] of Object.entries(args.where)) {
            if (!matchesFilter((e as any)[k], v)) match = false;
          }
          if (match) count++;
        }
        return count;
      },
      groupBy: async (args: { by: string[]; _count?: any; where?: any }) => {
        let list = [...inMemoryDb.events];
        if (args.where) {
          list = list.filter((e) => {
            for (const [k, v] of Object.entries(args.where)) {
              if (!matchesFilter((e as any)[k], v)) return false;
            }
            return true;
          });
        }
        const counts = new Map<string, number>();
        for (const item of list) {
          const key = (item as any)[args.by[0]];
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        const result: any[] = [];
        for (const [val, count] of counts.entries()) {
          result.push({
            [args.by[0]]: val,
            _count: {
              _all: count,
              id: count,
            },
          });
        }
        return result;
      },
      deleteMany: async (args?: { where?: any }) => {
        if (!args?.where) {
          const count = inMemoryDb.events.length;
          inMemoryDb.events = [];
          return { count };
        }
        const originalLen = inMemoryDb.events.length;
        inMemoryDb.events = inMemoryDb.events.filter((e) => {
          for (const [k, v] of Object.entries(args.where)) {
            if (!matchesFilter((e as any)[k], v)) return true;
          }
          return false;
        });
        return { count: originalLen - inMemoryDb.events.length };
      },
    },

    $queryRaw: async (_query: any) => {
      return [{ connected: 1 }];
    },

    $executeRawUnsafe: async (_sql: string) => {
      return 0;
    },
  };
}
