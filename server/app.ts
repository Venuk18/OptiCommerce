import express from 'express';
import healthRoutes from './routes/health.routes';
import merchantRoutes from './routes/merchant.routes';
import storeRoutes from './routes/store.routes';
import productRoutes from './routes/product.routes';
import aiRoutes from './routes/ai.routes';
import { errorHandler } from './middleware/error.middleware';
import { testDatabaseConnection, prisma } from './db/prisma';

export const app = express();

app.use(express.json());

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/ai', aiRoutes);

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

export async function initDatabase() {
  const dbStatus = await testDatabaseConnection();
  if (dbStatus.success) {
    console.log(`[Database] ${dbStatus.message}`);
    await ensureDefaultStore();
  } else {
    console.log(`[Database Notice] ${dbStatus.message}`);
  }
  return dbStatus;
}

export default app;
