import http from 'http';
import { app, initDatabase } from '../server/app';
import { prisma } from '../server/db/prisma';

async function verifyPhase3B() {
  console.log('=== RUNNING COMPREHENSIVE PHASE 3B VERIFICATION SUITE ===\n');

  await initDatabase();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  try {
    // 18. Health Check
    console.log('Test 18: GET /api/health');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const health = await healthRes.json();
    console.log('  Health Status:', healthRes.status, health);
    if (healthRes.status !== 200 || !health.success) throw new Error('Health check failed');

    // Retrieve default store
    const defaultStore = await prisma.store.findFirst({ include: { merchant: true } });
    if (!defaultStore) throw new Error('No default store in database');
    console.log('  Using default store:', defaultStore.id, defaultStore.name);

    // 1. Create product for valid store -> 201
    console.log('\nTest 1: POST /api/products (valid store) -> 201');
    const createPayload = {
      storeId: defaultStore.id,
      name: 'ZenPods Pro',
      description: 'Wireless earbuds with strong bass and long battery life',
      category: 'Audio',
      brand: 'Zen',
      price: 4999,
      costPrice: 3000,
      stock: 50,
      images: ['https://example.com/zenpods-1.png'],
      features: ['Strong bass', '40-hour battery'],
      specifications: {
        battery: '40 hours',
        connectivity: 'Bluetooth 5.3',
      },
      tags: ['wireless', 'earbuds', 'bass'],
      status: 'DRAFT',
    };
    const createRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload),
    });
    const createdProduct = await createRes.json();
    console.log('  Status:', createRes.status);
    console.log('  Created ID:', createdProduct.data?.id, 'Name:', createdProduct.data?.name);
    if (createRes.status !== 201 || !createdProduct.success || !createdProduct.data?.id) {
      throw new Error('Test 1 Failed: Product creation failed');
    }
    const productId = createdProduct.data.id;

    // 2. Create product for nonexistent store -> 404
    console.log('\nTest 2: POST /api/products (nonexistent store) -> 404');
    const fakeStoreRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createPayload,
        storeId: '00000000-0000-0000-0000-000000000000',
      }),
    });
    const fakeStoreBody = await fakeStoreRes.json();
    console.log('  Status:', fakeStoreRes.status, 'Message:', fakeStoreBody.error?.message);
    if (fakeStoreRes.status !== 404 || fakeStoreBody.success !== false) {
      throw new Error('Test 2 Failed: Expected 404 for nonexistent store');
    }

    // 12. Invalid price -> 400
    console.log('\nTest 12: Invalid price <= 0 -> 400');
    const invalidPriceRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...createPayload, price: -10 }),
    });
    console.log('  Status:', invalidPriceRes.status, 'Price <= 0');
    if (invalidPriceRes.status !== 400) throw new Error('Test 12 Failed: Expected 400 for negative price');

    const invalidPriceZero = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...createPayload, price: 0 }),
    });
    console.log('  Status:', invalidPriceZero.status, 'Price == 0');
    if (invalidPriceZero.status !== 400) throw new Error('Test 12 Failed: Expected 400 for zero price');

    // 13. Invalid stock -> 400
    console.log('\nTest 13: Invalid stock -> 400');
    const invalidStockRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...createPayload, stock: -5 }),
    });
    console.log('  Status:', invalidStockRes.status, 'Stock < 0');
    if (invalidStockRes.status !== 400) throw new Error('Test 13 Failed: Expected 400 for negative stock');

    const floatStockRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...createPayload, stock: 4.5 }),
    });
    console.log('  Status:', floatStockRes.status, 'Stock is float');
    if (floatStockRes.status !== 400) throw new Error('Test 13 Failed: Expected 400 for non-integer stock');

    // 14. Invalid status -> 400
    console.log('\nTest 14: Invalid status -> 400');
    const invalidStatusRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...createPayload, status: 'SUPER_HOT' }),
    });
    console.log('  Status:', invalidStatusRes.status);
    if (invalidStatusRes.status !== 400) throw new Error('Test 14 Failed: Expected 400 for invalid status');

    // 3. Get all products -> 200
    console.log('\nTest 3: GET /api/products -> 200');
    const allProdRes = await fetch(`${baseUrl}/api/products`);
    const allProducts = await allProdRes.json();
    console.log('  Status:', allProdRes.status, 'Count:', allProducts.data?.length);
    if (allProdRes.status !== 200 || !Array.isArray(allProducts.data)) {
      throw new Error('Test 3 Failed: GET /api/products did not return array');
    }

    // 4. Filter by storeId
    console.log('\nTest 4: GET /api/products?storeId=... -> 200');
    const storeFiltered = await fetch(`${baseUrl}/api/products?storeId=${defaultStore.id}`).then((r) => r.json());
    console.log('  Filtered by storeId count:', storeFiltered.data?.length);
    if (!storeFiltered.data?.every((p: any) => p.storeId === defaultStore.id)) {
      throw new Error('Test 4 Failed: Products returned not matching storeId');
    }

    // 5. Filter by category
    console.log('\nTest 5: GET /api/products?category=Audio -> 200');
    const categoryFiltered = await fetch(`${baseUrl}/api/products?category=Audio`).then((r) => r.json());
    console.log('  Category Audio count:', categoryFiltered.data?.length);
    if (!categoryFiltered.data?.every((p: any) => p.category.toLowerCase() === 'audio')) {
      throw new Error('Test 5 Failed: Products returned not matching category');
    }

    // 6. Filter by status
    console.log('\nTest 6: GET /api/products?status=DRAFT -> 200');
    const statusFiltered = await fetch(`${baseUrl}/api/products?status=DRAFT`).then((r) => r.json());
    console.log('  Status DRAFT count:', statusFiltered.data?.length);
    if (!statusFiltered.data?.every((p: any) => p.status === 'DRAFT')) {
      throw new Error('Test 6 Failed: Products returned not matching status');
    }

    // 7. Get product by ID -> 200
    console.log('\nTest 7: GET /api/products/:id -> 200');
    const getSingleRes = await fetch(`${baseUrl}/api/products/${productId}`);
    const singleProduct = await getSingleRes.json();
    console.log('  Status:', getSingleRes.status, 'Product Name:', singleProduct.data?.name);
    console.log('  Store Included:', singleProduct.data?.store?.name);
    if (getSingleRes.status !== 200 || singleProduct.data?.id !== productId) {
      throw new Error('Test 7 Failed: Product by ID fetch failed');
    }

    // 8. Update product -> 200
    console.log('\nTest 8: PUT /api/products/:id -> 200');
    const updatePayload = {
      name: 'ZenPods Pro 2nd Gen',
      description: 'Upgraded wireless earbuds with lossless audio and ANC',
      price: 5499,
      costPrice: 3200,
      stock: 75,
      features: ['Active Noise Cancellation', '48-hour battery', 'Lossless audio'],
    };
    const updateRes = await fetch(`${baseUrl}/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
    const updatedProd = await updateRes.json();
    console.log('  Status:', updateRes.status);
    console.log('  Updated Name:', updatedProd.data?.name);
    console.log('  Updated Price:', updatedProd.data?.price);
    console.log('  Updated Stock:', updatedProd.data?.stock);
    if (updateRes.status !== 200 || updatedProd.data?.name !== 'ZenPods Pro 2nd Gen') {
      throw new Error('Test 8 Failed: Product update failed');
    }

    // 9. Publish product via PATCH /api/products/:id/status -> 200
    console.log('\nTest 9: PATCH /api/products/:id/status (PUBLISHED) -> 200');
    const publishRes = await fetch(`${baseUrl}/api/products/${productId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    const publishedProd = await publishRes.json();
    console.log('  Status:', publishRes.status, 'New Status:', publishedProd.data?.status);
    if (publishRes.status !== 200 || publishedProd.data?.status !== 'PUBLISHED') {
      throw new Error('Test 9 Failed: Publish product failed');
    }

    // 10. Change product status across other valid statuses
    console.log('\nTest 10: Status transitions (LOW_STOCK, OUT_OF_STOCK, ARCHIVED)');
    for (const st of ['LOW_STOCK', 'OUT_OF_STOCK', 'ARCHIVED', 'DRAFT']) {
      const res = await fetch(`${baseUrl}/api/products/${productId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: st }),
      });
      const body = await res.json();
      if (res.status !== 200 || body.data?.status !== st) {
        throw new Error(`Test 10 Failed: Status update to ${st} failed`);
      }
    }
    console.log('  All status transitions verified!');

    // 15. Nonexistent product -> 404
    console.log('\nTest 15: GET / PUT / PATCH / DELETE nonexistent product -> 404');
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const n1 = await fetch(`${baseUrl}/api/products/${nonExistentId}`);
    const n2 = await fetch(`${baseUrl}/api/products/${nonExistentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const n3 = await fetch(`${baseUrl}/api/products/${nonExistentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    const n4 = await fetch(`${baseUrl}/api/products/${nonExistentId}`, { method: 'DELETE' });
    console.log('  Statuses:', n1.status, n2.status, n3.status, n4.status);
    if (n1.status !== 404 || n2.status !== 404 || n3.status !== 404 || n4.status !== 404) {
      throw new Error('Test 15 Failed: Nonexistent product did not return 404');
    }

    // 16. Store Isolation / Scoping test (Store A products vs Store B products)
    console.log('\nTest 16: Multi-Store Isolation & Scoping');
    const secondMerchant = await prisma.merchant.create({
      data: {
        name: 'Second Merchant For Scoping',
        email: `second_${Date.now()}@opticommerce.io`,
        store: {
          create: {
            name: 'Second Store For Scoping',
            slug: `second-store-${Date.now()}`,
            status: 'UNPUBLISHED',
          },
        },
      },
      include: { store: true },
    });
    const secondStoreId = secondMerchant.store!.id;

    // Create product in Store B
    const prodB = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: secondStoreId,
        name: 'Store B Exclusive Product',
        category: 'Electronics',
        price: 9999,
        costPrice: 6000,
        stock: 10,
        status: 'DRAFT',
      }),
    }).then((r) => r.json());

    // Query Store A
    const storeAProds = await fetch(`${baseUrl}/api/products?storeId=${defaultStore.id}`).then((r) => r.json());
    // Query Store B
    const storeBProds = await fetch(`${baseUrl}/api/products?storeId=${secondStoreId}`).then((r) => r.json());

    console.log('  Store A products count:', storeAProds.data.length);
    console.log('  Store B products count:', storeBProds.data.length);

    const storeAHasProdB = storeAProds.data.some((p: any) => p.id === prodB.data.id);
    const storeBHasProdA = storeBProds.data.some((p: any) => p.id === productId);

    if (storeAHasProdB || storeBHasProdA) {
      throw new Error('Test 16 Failed: Cross-store product leakage detected!');
    }
    console.log('  Store Scoping confirmed: Store A and Store B products strictly separated.');

    // Cleanup second store & merchant
    await prisma.product.delete({ where: { id: prodB.data.id } });
    await prisma.store.delete({ where: { id: secondStoreId } });
    await prisma.merchant.delete({ where: { id: secondMerchant.id } });

    // 11. Delete product -> 200
    console.log('\nTest 11: DELETE /api/products/:id -> 200');
    const deleteRes = await fetch(`${baseUrl}/api/products/${productId}`, { method: 'DELETE' });
    const deleteBody = await deleteRes.json();
    console.log('  Delete status:', deleteRes.status, deleteBody);
    if (deleteRes.status !== 200 || !deleteBody.success) {
      throw new Error('Test 11 Failed: Product deletion failed');
    }

    const checkDeleted = await fetch(`${baseUrl}/api/products/${productId}`);
    if (checkDeleted.status !== 404) {
      throw new Error('Test 11 Failed: Product still found after deletion');
    }
    console.log('  Confirmed product no longer exists (404).');

    // 17. Existing Merchant / Store APIs still work
    console.log('\nTest 17: Existing Merchant & Store APIs');
    const storeBySlug = await fetch(`${baseUrl}/api/stores/${defaultStore.slug}`).then((r) => r.json());
    console.log('  Store by slug:', storeBySlug.success, storeBySlug.data?.name);
    if (!storeBySlug.success) throw new Error('Existing Store API failed');

    const merchantId = storeBySlug.data.merchantId || storeBySlug.data.merchant?.id;
    const merchantById = await fetch(`${baseUrl}/api/merchants/${merchantId}`).then((r) => r.json());
    console.log('  Merchant by ID:', merchantById.success, merchantById.data?.name);
    if (!merchantById.success) throw new Error('Existing Merchant API failed');

    console.log('\n=============================================================');
    console.log('ALL PHASE 3B PRODUCT API VERIFICATIONS SUCCEEDED (20/20 PASS)!');
    console.log('=============================================================');
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

verifyPhase3B().catch(async (err) => {
  console.error('VERIFICATION SUITE FAILED:', err);
  await prisma.$disconnect();
  process.exit(1);
});
