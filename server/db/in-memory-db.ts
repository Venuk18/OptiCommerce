import { StoreStatus, ProductStatus, OrderStatus, PaymentStatus, AttributionSource, CommerceEventType } from '@prisma/client';
import { DEMO_MERCHANT, DEMO_STORE, INITIAL_100_PRODUCTS } from './seed-catalog';

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
  customers?: InMemoryCustomer[];
}

export interface InMemoryCustomer {
  id: string;
  storeId: string;
  name: string | null;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  store?: InMemoryStore | null;
  carts?: InMemoryCart[];
  orders?: InMemoryOrder[];
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
  cart?: InMemoryCart;
}

export interface InMemoryCart {
  id: string;
  sessionId: string;
  storeId: string;
  customerId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: InMemoryCartItem[];
  customer?: InMemoryCustomer | null;
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
  customerId?: string | null;
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
  customer?: InMemoryCustomer | null;
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
  customers = new Map<string, InMemoryCustomer>();
  events: InMemoryCommerceEvent[] = [];

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const merchantId = DEMO_MERCHANT.id;
    const storeId = DEMO_STORE.id;

    const defaultMerchant: InMemoryMerchant = {
      id: merchantId,
      name: DEMO_MERCHANT.name,
      email: DEMO_MERCHANT.email,
      passwordHash: DEMO_MERCHANT.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.merchants.set(merchantId, defaultMerchant);

    const defaultStore: InMemoryStore = {
      id: storeId,
      merchantId: merchantId,
      name: DEMO_STORE.name,
      slug: DEMO_STORE.slug,
      description: DEMO_STORE.description,
      status: DEMO_STORE.status as StoreStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.stores.set(storeId, defaultStore);

    for (const p of INITIAL_100_PRODUCTS) {
      this.products.set(p.id, {
        ...p,
        status: p.status as ProductStatus,
        specifications: p.specifications || {},
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
      subtotal: 9498,
      discount: 475,
      total: 9023,
      currency: 'INR',
      createdAt: new Date(Date.now() - 3600 * 1000 * 4),
      updatedAt: new Date(),
    };
    this.orders.set(orderId1, sampleOrder1);

    const orderItem1: InMemoryOrderItem = {
      id: 'item-demo-001',
      orderId: orderId1,
      productId: 'prod-001',
      productName: 'SoundCore Space One Hybrid ANC Wireless Headphones',
      quantity: 1,
      unitPrice: 4499,
      discountPercent: 5,
      discountAmount: 225,
      lineTotal: 4274,
      attributionSource: 'AI_CHAT' as AttributionSource,
      createdAt: new Date(),
    };
    const orderItem2: InMemoryOrderItem = {
      id: 'item-demo-002',
      orderId: orderId1,
      productId: 'prod-002',
      productName: 'JBL Tune 760NC Wireless Over-Ear NC Headphones',
      quantity: 1,
      unitPrice: 4999,
      discountPercent: 5,
      discountAmount: 250,
      lineTotal: 4749,
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
      if (filter.mode === 'insensitive' && typeof val === 'string' && typeof filter.equals === 'string') {
        if (val.toLowerCase() !== filter.equals.toLowerCase()) return false;
      } else {
        if (val !== filter.equals) return false;
      }
    }
    if (filter.not !== undefined) {
      if (typeof filter.not === 'object' && filter.not !== null) {
        if (matchesFilter(val, filter.not)) return false;
      } else if (val === filter.not) {
        return false;
      }
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
    if (filter.has !== undefined) {
      if (!Array.isArray(val)) return false;
      const target = String(filter.has).toLowerCase();
      const hasItem = val.some((elem: any) => String(elem).toLowerCase() === target || String(elem).toLowerCase().includes(target));
      if (!hasItem) return false;
    }
    if (Array.isArray(filter.hasSome)) {
      if (!Array.isArray(val)) return false;
      const targetSet = new Set(filter.hasSome.map((x: any) => String(x).toLowerCase()));
      const hasSomeItem = val.some((elem: any) => targetSet.has(String(elem).toLowerCase()));
      if (!hasSomeItem) return false;
    }
    if (Array.isArray(filter.hasEvery)) {
      if (!Array.isArray(val)) return false;
      const valSet = new Set(val.map((elem: any) => String(elem).toLowerCase()));
      const hasEveryItem = filter.hasEvery.every((x: any) => valSet.has(String(x).toLowerCase()));
      if (!hasEveryItem) return false;
    }
    return true;
  }

  if (val instanceof Date && filter instanceof Date) {
    return val.getTime() === filter.getTime();
  }
  return val === filter;
}

export function matchesWhere(item: any, where: any): boolean {
  if (!where || typeof where !== 'object') return true;

  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;

    if (k === 'OR') {
      if (Array.isArray(v)) {
        if (v.length === 0) continue;
        const matched = v.some((cond) => matchesWhere(item, cond));
        if (!matched) return false;
      }
      continue;
    }

    if (k === 'AND') {
      if (Array.isArray(v)) {
        const matched = v.every((cond) => matchesWhere(item, cond));
        if (!matched) return false;
      } else if (typeof v === 'object' && v !== null) {
        if (!matchesWhere(item, v)) return false;
      }
      continue;
    }

    if (k === 'NOT') {
      if (Array.isArray(v)) {
        const matched = v.some((cond) => matchesWhere(item, cond));
        if (matched) return false;
      } else if (typeof v === 'object' && v !== null) {
        if (matchesWhere(item, v)) return false;
      }
      continue;
    }

    if (!matchesFilter((item as any)[k], v)) {
      return false;
    }
  }

  return true;
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

    customer: {
      findUnique: async (args: {
        where: { id?: string; storeId_email?: { storeId: string; email: string } };
        include?: any;
      }) => {
        let target: InMemoryCustomer | null = null;
        if (args.where.id) {
          target = inMemoryDb.customers.get(args.where.id) || null;
        } else if (args.where.storeId_email) {
          const { storeId, email } = args.where.storeId_email;
          target =
            Array.from(inMemoryDb.customers.values()).find(
              (c) => c.storeId === storeId && c.email.toLowerCase() === email.toLowerCase()
            ) || null;
        }
        if (!target) return null;
        const result: any = { ...target };
        if (args.include?.store) {
          result.store = inMemoryDb.stores.get(target.storeId) || null;
        }
        if (args.include?.carts) {
          result.carts = Array.from(inMemoryDb.carts.values()).filter((c) => c.customerId === target!.id);
        }
        if (args.include?.orders) {
          result.orders = Array.from(inMemoryDb.orders.values()).filter((o) => o.customerId === target!.id);
        }
        return result;
      },
      findFirst: async (args?: { where?: any; include?: any }) => {
        for (const c of inMemoryDb.customers.values()) {
          if (matchesWhere(c, args?.where)) {
            const result: any = { ...c };
            if (args?.include?.store) {
              result.store = inMemoryDb.stores.get(c.storeId) || null;
            }
            if (args?.include?.carts) {
              result.carts = Array.from(inMemoryDb.carts.values()).filter((cart) => cart.customerId === c.id);
            }
            if (args?.include?.orders) {
              result.orders = Array.from(inMemoryDb.orders.values()).filter((o) => o.customerId === c.id);
            }
            return result;
          }
        }
        return null;
      },
      findMany: async (args?: { where?: any; include?: any }) => {
        let list = Array.from(inMemoryDb.customers.values());
        if (args?.where) {
          list = list.filter((c) => matchesWhere(c, args.where));
        }
        return list.map((c) => {
          const result: any = { ...c };
          if (args?.include?.store) {
            result.store = inMemoryDb.stores.get(c.storeId) || null;
          }
          return result;
        });
      },
      create: async (args: { data: any; include?: any }) => {
        // Enforce @@unique([storeId, email])
        for (const existing of inMemoryDb.customers.values()) {
          if (
            existing.storeId === args.data.storeId &&
            existing.email.toLowerCase() === (args.data.email || '').toLowerCase()
          ) {
            const err: any = new Error('Unique constraint failed on the fields: (`storeId`,`email`)');
            err.code = 'P2002';
            err.meta = { target: ['storeId', 'email'] };
            throw err;
          }
        }

        const id = args.data.id || `customer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const customer: InMemoryCustomer = {
          id,
          storeId: args.data.storeId,
          name: args.data.name || null,
          email: args.data.email,
          passwordHash: args.data.passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryDb.customers.set(id, customer);
        const result: any = { ...customer };
        if (args.include?.store) {
          result.store = inMemoryDb.stores.get(customer.storeId) || null;
        }
        return result;
      },
      update: async (args: { where: { id: string }; data: any }) => {
        const c = inMemoryDb.customers.get(args.where.id);
        if (!c) throw new Error('Customer not found');
        const updated = { ...c, ...args.data, updatedAt: new Date() };
        inMemoryDb.customers.set(args.where.id, updated);
        return { ...updated };
      },
      delete: async (args: { where: { id: string } }) => {
        const c = inMemoryDb.customers.get(args.where.id);
        if (c) inMemoryDb.customers.delete(args.where.id);
        return c;
      },
      count: async (args?: { where?: any }) => {
        if (!args?.where) return inMemoryDb.customers.size;
        let count = 0;
        for (const c of inMemoryDb.customers.values()) {
          if (matchesWhere(c, args.where)) count++;
        }
        return count;
      },
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
          if (matchesWhere(s, args?.where)) {
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
          if (matchesWhere(p, args?.where)) return { ...p };
        }
        return null;
      },
      findMany: async (args?: { where?: any; orderBy?: any; take?: number; skip?: number; select?: any }) => {
        let list = Array.from(inMemoryDb.products.values());
        if (args?.where) {
          list = list.filter((p) => matchesWhere(p, args.where));
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
      findFirst: async (args?: { where?: any; include?: any }) => {
        let target: InMemoryCart | null = null;
        for (const c of inMemoryDb.carts.values()) {
          if (matchesWhere(c, args?.where)) {
            target = c;
            break;
          }
        }
        if (!target) return null;
        const result = { ...target };
        if (args?.include?.items) {
          const items = Array.from(inMemoryDb.cartItems.values()).filter((item) => item.cartId === target!.id);
          result.items = items.map((item) => {
            const itemCopy = { ...item };
            if (args?.include?.items?.include?.product) {
              itemCopy.product = inMemoryDb.products.get(item.productId);
            }
            return itemCopy;
          });
        }
        if (args?.include?.customer) {
          result.customer = target.customerId ? inMemoryDb.customers.get(target.customerId) || null : null;
        }
        return result;
      },
      create: async (args: { data: any; include?: any }) => {
        const id = args.data.id || `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const cart: InMemoryCart = {
          id,
          sessionId: args.data.sessionId,
          storeId: args.data.storeId,
          customerId: args.data.customerId || null,
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
            customerId: args.create.customerId || null,
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
      findMany: async (args?: { where?: any; include?: any }) => {
        let list = Array.from(inMemoryDb.carts.values());
        if (args?.where) {
          list = list.filter((c) => matchesWhere(c, args.where));
        }
        return list.map((c) => ({ ...c }));
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
        if (args.include?.cart) {
          result.cart = inMemoryDb.carts.get(target.cartId);
        }
        return result;
      },
      findFirst: async (args?: { where?: any; include?: any }) => {
        let items = Array.from(inMemoryDb.cartItems.values());
        if (args?.where?.id) {
          items = items.filter((item) => item.id === args.where.id);
        }
        if (args?.where?.cartId) {
          items = items.filter((item) => item.cartId === args.where.cartId);
        }
        if (args?.where?.productId) {
          items = items.filter((item) => item.productId === args.where.productId);
        }
        const target = items[0] || null;
        if (!target) return null;
        const result = { ...target };
        if (args?.include?.product) {
          result.product = inMemoryDb.products.get(target.productId);
        }
        if (args?.include?.cart) {
          result.cart = inMemoryDb.carts.get(target.cartId);
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
        if (args.include?.cart) {
          result.cart = inMemoryDb.carts.get(item.cartId);
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
        if (args.include?.cart) {
          result.cart = inMemoryDb.carts.get(item.cartId);
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
          orders = orders.filter((o) => matchesWhere(o, args.where));
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
          customerId: args.data.customerId || null,
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
