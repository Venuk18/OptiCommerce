import { INITIAL_100_PRODUCTS } from './db/seed-catalog';
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
import authRoutes from './routes/auth.routes';
import customerAuthRoutes from './routes/customer-auth.routes';
import commercialRoutes from './routes/commercial.routes';
import { hashPassword } from './utils/password';
import { errorHandler } from './middleware/error.middleware';
import { testDatabaseConnection, prisma } from './db/prisma';
import { config } from './config/env';

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
app.use('/api/auth', authRoutes);
app.use('/api/customer-auth', customerAuthRoutes);
app.use('/api/commercial', commercialRoutes);

// Error handling middleware
app.use(errorHandler);

export async function ensureDefaultStore() {
  try {
    let defaultStore = (await prisma.store.findFirst({
      where: { slug: 'opticommerce-flagship-electronics' },
      include: { merchant: true },
    })) || (await prisma.store.findFirst({
      include: { merchant: true },
    }));
    if (!defaultStore) {
      const defaultPasswordHash = await hashPassword('Merchant@2026');
      const defaultMerchant = await prisma.merchant.create({
        data: {
          name: 'OptiCommerce Flagship Merchant',
          email: 'merchant@opticommerce.io',
          passwordHash: defaultPasswordHash,
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
      if (config.databaseUrl) {
        console.log('[Database] Production catalog seeding skipped; use npm run seed:demo for explicit catalog provisioning.');
      } else {
        const productCount = await prisma.product.count({
          where: { storeId: defaultStore.id },
        });
        if (productCount <= 1) {
          // If 0 or 1 product (from test runs), seed the standard store catalog
          await prisma.product.createMany({
            data: INITIAL_100_PRODUCTS.map((p) => ({ ...p, storeId: defaultStore.id })),
          });
          console.log(`[Database] Seeded default catalog products for store: ${defaultStore.name}`);
        }
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

export async function ensureCustomerTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Customer" (
          "id" TEXT NOT NULL,
          "storeId" TEXT NOT NULL,
          "name" TEXT,
          "email" TEXT NOT NULL,
          "passwordHash" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Customer_storeId_email_key" ON "Customer"("storeId", "email");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Customer_storeId_idx" ON "Customer"("storeId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Customer_email_idx" ON "Customer"("email");`);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
          ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    // Ensure customerId column and relation exist on Cart
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Cart" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
      EXCEPTION
        WHEN others THEN null;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cart_customerId_idx" ON "Cart"("customerId");`);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Ensure customerId column and relation exist on Order
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
      EXCEPTION
        WHEN others THEN null;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");`);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('[Database] Customer schema verified and ready');
  } catch (error) {
    console.warn('[Database] ensureCustomerTable notice:', error);
  }
}

export async function initDatabase() {
  const dbStatus = await testDatabaseConnection();
  if (dbStatus.success) {
    console.log(`[Database] ${dbStatus.message}`);
    await ensureEventTable();
    await ensureCustomerTable();
    await ensureCartTable();
    await ensureOrderTable();
    await ensureDefaultStore();
  } else {
    console.log(`[Database Notice] ${dbStatus.message}`);
  }
  return dbStatus;
}

export default app;
