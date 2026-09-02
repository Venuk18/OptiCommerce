import express from 'express';
import healthRoutes from './routes/health.routes';
import merchantRoutes from './routes/merchant.routes';
import storeRoutes from './routes/store.routes';
import productRoutes from './routes/product.routes';
import aiRoutes from './routes/ai.routes';
import eventRoutes from './routes/event.routes';
import revenueRoutes from './routes/revenue.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import paymentRoutes from './routes/payment.routes';
import merchantDashboardRoutes from './routes/merchant-dashboard.routes';
import { errorHandler } from './middleware/error.middleware';
import { testDatabaseConnection, prisma } from './db/prisma';

export const app = express();

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf ? buf.toString('utf8') : '';
    },
  })
);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/merchant-dashboard', merchantDashboardRoutes);

// Error handling middleware
app.use(errorHandler);

export async function ensureDefaultStore() {
  try {
    let defaultStore = await prisma.store.findFirst({
      include: { merchant: true },
    });
    if (!defaultStore) {
      const defaultMerchant = await prisma.merchant.create({
        data: {
          name: 'OptiCommerce Flagship Merchant',
          email: 'merchant@opticommerce.io',
          store: {
            create: {
              name: 'OptiCommerce Flagship Electronics',
              slug: 'opticommerce-flagship-electronics',
              description: 'Flagship online electronics and smart devices storefront powered by AI margin optimization.',
              status: 'PUBLISHED',
            },
          },
        },
        include: {
          store: true,
        },
      });
      defaultStore = defaultMerchant.store ? { ...defaultMerchant.store, merchant: defaultMerchant } : null;
      console.log(`[Database] Initialized default flagship merchant & store: ${defaultMerchant.id} (${defaultMerchant.store?.slug})`);
    }

    if (defaultStore) {
      const productCount = await prisma.product.count({
        where: { storeId: defaultStore.id },
      });
      if (productCount <= 1) {
        // If 0 or 1 product (from test runs), seed the standard store catalog
        await prisma.product.createMany({
          data: [
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'LOW_STOCK',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
              name: 'AlphaVision NightShot Pro Mirrorless',
              description: 'Back-illuminated full-frame sensor with dual native ISO for ultra low-noise astro and night photography.',
              category: 'Electronics',
              brand: 'AlphaVision',
              price: 74999,
              costPrice: 51000,
              stock: 0,
              images: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80'],
              features: ['24.2MP BSI Full-Frame', 'Dual Native ISO', '5-Axis Sensor Stabilization'],
              tags: ['camera', 'mirrorless', 'night', 'electronics', '4k'],
              status: 'OUT_OF_STOCK',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
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
              status: 'PUBLISHED',
            },
            {
              storeId: defaultStore.id,
              name: 'FastCharge Pro Station (GaN 100W)',
              description: '100W GaN 4-in-1 fast charger with intelligent power allocation across 3x USB-C and 1x USB-A.',
              category: 'Accessories',
              brand: 'FastCharge',
              price: 3499,
              costPrice: 1800,
              stock: 65,
              images: ['https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&auto=format&fit=crop&q=80'],
              features: ['100W GaN III Fast Power', 'Quad Port Output', 'Active Temperature Monitor'],
              tags: ['charger', 'gan', 'fast charge', 'accessories'],
              status: 'DRAFT',
            }
          ]
        });
        console.log(`[Database] Seeded default catalog products for store: ${defaultStore.name}`);
      }
    }
  } catch (error) {
    console.warn('[Database] ensureDefaultStore notice:', error);
  }
}

export async function ensureEventTable() {
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
          CREATE TYPE "CommerceEventType" AS ENUM (
              'SEARCH',
              'RECOMMENDATION_VIEW',
              'RECOMMENDATION_CLICK',
              'PRODUCT_VIEW',
              'ADD_TO_CART',
              'REMOVE_FROM_CART',
              'CHECKOUT_STARTED',
              'OFFER_VIEW',
              'OFFER_ACCEPTED',
              'OFFER_REJECTED',
              'PURCHASE'
          );
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommerceEvent" (
          "id" TEXT NOT NULL,
          "sessionId" TEXT NOT NULL,
          "storeId" TEXT NOT NULL,
          "productId" TEXT,
          "eventType" "CommerceEventType" NOT NULL,
          "metadata" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "CommerceEvent_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommerceEvent_sessionId_idx" ON "CommerceEvent"("sessionId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommerceEvent_storeId_idx" ON "CommerceEvent"("storeId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommerceEvent_productId_idx" ON "CommerceEvent"("productId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommerceEvent_eventType_idx" ON "CommerceEvent"("eventType");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommerceEvent_createdAt_idx" ON "CommerceEvent"("createdAt");`);
    console.log('[Database] CommerceEvent schema verified and ready');
  } catch (error) {
    console.warn('[Database] ensureEventTable notice:', error);
  }
}

export async function ensureCartTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Cart" (
          "id" TEXT NOT NULL,
          "sessionId" TEXT NOT NULL,
          "storeId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CartItem" (
          "id" TEXT NOT NULL,
          "cartId" TEXT NOT NULL,
          "productId" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL DEFAULT 1,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Cart_sessionId_storeId_key" ON "Cart"("sessionId", "storeId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cart_sessionId_idx" ON "Cart"("sessionId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cart_storeId_idx" ON "Cart"("storeId");`);

    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CartItem_cartId_idx" ON "CartItem"("cartId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CartItem_productId_idx" ON "CartItem"("productId");`);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
          ALTER TABLE "Cart" ADD CONSTRAINT "Cart_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
          ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
          ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('[Database] Cart and CartItem schema verified and ready');
  } catch (error) {
    console.warn('[Database] ensureCartTable notice:', error);
  }
}

export async function ensureOrderTable() {
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'REFUNDED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Order" (
        "id" TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "storeId" TEXT NOT NULL,
        "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
        "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
        "razorpayOrderId" TEXT,
        "razorpayPaymentId" TEXT,
        "subtotal" DECIMAL(10,2) NOT NULL,
        "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
        "total" DECIMAL(10,2) NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'INR',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'CREATED';
        ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT;
        ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "razorpayPaymentId" TEXT;
      EXCEPTION
        WHEN others THEN null;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OrderItem" (
        "id" TEXT NOT NULL,
        "orderId" TEXT NOT NULL,
        "productId" TEXT NOT NULL,
        "productName" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "unitPrice" DECIMAL(10,2) NOT NULL,
        "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
        "lineTotal" DECIMAL(10,2) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_sessionId_idx" ON "Order"("sessionId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_storeId_idx" ON "Order"("storeId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");`);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('[Database] Order and OrderItem schema verified and ready');
  } catch (error) {
    console.warn('[Database] ensureOrderTable notice:', error);
  }
}

export async function initDatabase() {
  const dbStatus = await testDatabaseConnection();
  if (dbStatus.success) {
    console.log(`[Database] ${dbStatus.message}`);
    await ensureEventTable();
    await ensureCartTable();
    await ensureOrderTable();
    await ensureDefaultStore();
  } else {
    console.log(`[Database Notice] ${dbStatus.message}`);
  }
  return dbStatus;
}

export default app;
