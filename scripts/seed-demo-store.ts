import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { INITIAL_100_PRODUCTS } from '../server/db/seed-catalog';
import { normalizeDatabaseUrl } from '../server/config/env';

// Load environment variables
dotenv.config();

const TARGET_SLUG = 'opticommerce-flagship-electronics';

export async function seedDemoStore() {
  console.log('\n==================================================');
  console.log('OPTICOMMERCE PRODUCTION DEMO-STORE SEEDER');
  console.log('==================================================\n');

  // 1. Require DATABASE_URL; abort immediately without in-memory fallback
  const rawDatabaseUrl = process.env.DATABASE_URL;
  if (!rawDatabaseUrl || !rawDatabaseUrl.trim()) {
    console.error('[ABORT] DATABASE_URL environment variable is required.');
    console.error('Please configure DATABASE_URL to connect to the production PostgreSQL database.');
    process.exit(1);
  }

  const databaseUrl = normalizeDatabaseUrl(rawDatabaseUrl);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    // 2. Locate the flagship store by slug
    console.log(`[1/5] Locating flagship store with slug: "${TARGET_SLUG}" ...`);
    const flagshipStore = await prisma.store.findUnique({
      where: { slug: TARGET_SLUG },
    });

    if (!flagshipStore) {
      console.error(`[ABORT] Flagship store with slug "${TARGET_SLUG}" was not found in the database.`);
      process.exit(1);
    }

    console.log(`      Found store: "${flagshipStore.name}" (ID: ${flagshipStore.id})`);

    // 3. Verify store has zero orders before modifying products
    console.log(`[2/5] Checking existing orders for store ${flagshipStore.id} ...`);
    const orderCount = await prisma.order.count({
      where: { storeId: flagshipStore.id },
    });

    if (orderCount > 0) {
      console.error(
        `[ABORT] Flagship store currently has ${orderCount} existing order(s).` +
        ` Cannot replace catalog products because OrderItem uses onDelete Restrict.`
      );
      process.exit(1);
    }
    console.log(`      Verified 0 orders exist for this store.`);

    // 4. Query current product count for reporting
    const previousProductCount = await prisma.product.count({
      where: { storeId: flagshipStore.id },
    });
    console.log(`      Current flagship product count: ${previousProductCount}`);

    // 5. Prepare the 100 products with flagship storeId
    console.log(`[3/5] Preparing ${INITIAL_100_PRODUCTS.length} catalog products ...`);
    const productsToInsert = INITIAL_100_PRODUCTS.map((prod) => ({
      id: prod.id,
      storeId: flagshipStore.id,
      name: prod.name,
      description: prod.description ?? null,
      category: prod.category,
      brand: prod.brand ?? null,
      price: prod.price,
      costPrice: prod.costPrice,
      stock: prod.stock ?? 0,
      images: prod.images ?? [],
      features: prod.features ?? [],
      specifications: (prod.specifications as any) ?? {},
      tags: prod.tags ?? [],
      status: prod.status || 'PUBLISHED',
    }));

    // 6. Execute atomic transaction: delete existing flagship products and insert new 100
    console.log(`[4/5] Executing atomic replacement transaction ...`);
    await prisma.$transaction(async (tx) => {
      // Delete ONLY products belonging to this specific store
      const deleteResult = await tx.product.deleteMany({
        where: { storeId: flagshipStore.id },
      });
      console.log(`      Deleted ${deleteResult.count} previous product(s) for store ${flagshipStore.id}.`);

      // Insert all 100 products
      const insertResult = await tx.product.createMany({
        data: productsToInsert,
      });
      console.log(`      Inserted ${insertResult.count} catalog product(s).`);
    });

    // 7. Post-insertion verification
    console.log(`[5/5] Verifying seeded catalog invariants ...`);
    const finalProducts = await prisma.product.findMany({
      where: { storeId: flagshipStore.id },
    });

    // Invariant A: Total count is exactly 100
    if (finalProducts.length !== 100) {
      throw new Error(`Verification failed: expected 100 products, but found ${finalProducts.length}`);
    }

    // Invariant B: All 100 products have the flagship storeId
    const foreignStoreProducts = finalProducts.filter((p) => p.storeId !== flagshipStore.id);
    if (foreignStoreProducts.length > 0) {
      throw new Error(`Verification failed: ${foreignStoreProducts.length} product(s) do not match flagship storeId.`);
    }

    // Invariant C: No duplicate product IDs
    const productIds = finalProducts.map((p) => p.id);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== 100) {
      throw new Error(`Verification failed: duplicate product IDs found (${uniqueIds.size} unique vs 100 total).`);
    }

    // Invariant D: All inserted products are PUBLISHED
    const nonPublished = finalProducts.filter((p) => p.status !== 'PUBLISHED');
    if (nonPublished.length > 0) {
      throw new Error(`Verification failed: ${nonPublished.length} product(s) are not in PUBLISHED status.`);
    }

    // 8. Output final audit report
    console.log('\n--------------------------------------------------');
    console.log('SEED EXECUTION SUMMARY:');
    console.log(`- Store Name:             ${flagshipStore.name}`);
    console.log(`- Store Slug:             ${flagshipStore.slug}`);
    console.log(`- Actual Store ID:        ${flagshipStore.id}`);
    console.log(`- Previous Product Count: ${previousProductCount}`);
    console.log(`- Inserted Product Count: ${productsToInsert.length}`);
    console.log(`- Final Product Count:    ${finalProducts.length}`);
    console.log('- Result:                 SUCCESS');
    console.log('--------------------------------------------------\n');
  } catch (error: any) {
    console.error('\n--------------------------------------------------');
    console.error('- Result:                 FAILURE');
    console.error(`- Error:                  ${error?.message || error}`);
    console.error('--------------------------------------------------\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute when run as script
if (process.argv[1]?.endsWith('seed-demo-store.ts') || process.argv[1]?.endsWith('seed-demo-store.js')) {
  seedDemoStore();
}
