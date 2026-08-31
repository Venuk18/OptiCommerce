import http from 'http';
import { app, initDatabase } from '../server/app';
import { prisma } from '../server/db/prisma';

async function verifyPhase3C() {
  console.log('=== RUNNING PHASE 3C VERIFICATION SUITE ===\n');

  await initDatabase();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  try {
    // 1. Get default store
    const store = await prisma.store.findFirst({
      include: { merchant: true },
    });
    if (!store) {
      throw new Error('Default store not found');
    }
    console.log(`[Phase 3C] Connected to store: "${store.name}" (${store.id})`);

    // 2. Test GET /api/products?storeId={storeId}
    console.log('\nTest 1: GET /api/products?storeId={storeId}');
    const res1 = await fetch(`${baseUrl}/api/products?storeId=${store.id}`);
    const body1 = await res1.json();
    console.log('  Status:', res1.status, 'Count:', body1.data?.length);
    if (res1.status !== 200 || !body1.success || !Array.isArray(body1.data)) {
      throw new Error('Test 1 Failed: Could not get products for store');
    }
    if (body1.data.length === 0) {
      throw new Error('Test 1 Failed: Expected products in default catalog');
    }
    console.log('  Sample product fields:', {
      name: body1.data[0].name,
      category: body1.data[0].category,
      price: body1.data[0].price,
      costPrice: body1.data[0].costPrice,
      stock: body1.data[0].stock,
      status: body1.data[0].status,
    });

    // 3. Test GET /api/products?storeId={storeId}&category=Audio
    console.log('\nTest 2: GET /api/products?storeId={storeId}&category=Audio');
    const res2 = await fetch(`${baseUrl}/api/products?storeId=${store.id}&category=Audio`);
    const body2 = await res2.json();
    console.log('  Status:', res2.status, 'Audio count:', body2.data?.length);
    if (res2.status !== 200 || !body2.data?.every((p: any) => p.category.toLowerCase() === 'audio')) {
      throw new Error('Test 2 Failed: Category filter failed');
    }

    // 4. Test GET /api/products?storeId={storeId}&status=PUBLISHED
    console.log('\nTest 3: GET /api/products?storeId={storeId}&status=PUBLISHED');
    const res3 = await fetch(`${baseUrl}/api/products?storeId=${store.id}&status=PUBLISHED`);
    const body3 = await res3.json();
    console.log('  Status:', res3.status, 'PUBLISHED count:', body3.data?.length);
    if (res3.status !== 200 || !body3.data?.every((p: any) => p.status === 'PUBLISHED')) {
      throw new Error('Test 3 Failed: Status filter failed');
    }

    // 5. Test PATCH /api/products/:id/status across statuses
    const targetProduct = body1.data[0];
    console.log(`\nTest 4: Status updates on product "${targetProduct.name}" (${targetProduct.id})`);
    
    const statusesToTest = ['LOW_STOCK', 'OUT_OF_STOCK', 'DRAFT', 'ARCHIVED', 'PUBLISHED'];
    for (const status of statusesToTest) {
      const patchRes = await fetch(`${baseUrl}/api/products/${targetProduct.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const patchBody = await patchRes.json();
      console.log(`  Updated status to ${status} -> HTTP ${patchRes.status} (New status: ${patchBody.data?.status})`);
      if (patchRes.status !== 200 || patchBody.data?.status !== status) {
        throw new Error(`Test 4 Failed: Status transition to ${status} failed`);
      }
    }

    // 6. Test Create temporary product and Delete it
    console.log('\nTest 5: Temporary Product Creation and DELETE /api/products/:id');
    const tempProdRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: store.id,
        name: 'Temporary Test Product For Deletion',
        category: 'Accessories',
        price: 999,
        costPrice: 500,
        stock: 5,
        status: 'DRAFT',
      }),
    });
    const tempProd = await tempProdRes.json();
    const tempId = tempProd.data.id;
    console.log('  Created temp product:', tempId);

    const deleteRes = await fetch(`${baseUrl}/api/products/${tempId}`, {
      method: 'DELETE',
    });
    const deleteBody = await deleteRes.json();
    console.log('  Deleted temp product status:', deleteRes.status, deleteBody);
    if (deleteRes.status !== 200 || !deleteBody.success) {
      throw new Error('Test 5 Failed: Delete product failed');
    }

    const checkGone = await fetch(`${baseUrl}/api/products/${tempId}`);
    if (checkGone.status !== 404) {
      throw new Error('Test 5 Failed: Deleted product still exists');
    }
    console.log('  Confirmed product is 404 deleted.');

    console.log('\n=============================================================');
    console.log('ALL PHASE 3C PRODUCT INTEGRATION TESTS PASSED (100% SUCCESS)!');
    console.log('=============================================================');
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

verifyPhase3C().catch(async (err) => {
  console.error('PHASE 3C VERIFICATION FAILED:', err);
  await prisma.$disconnect();
  process.exit(1);
});
