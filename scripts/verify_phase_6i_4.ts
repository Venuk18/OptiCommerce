import jwt from 'jsonwebtoken';
import http from 'http';
import { app, initDatabase } from '../server/app';
import { prisma } from '../server/db/prisma';
import { signMerchantToken } from '../server/utils/jwt';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'opticommerce-jwt-secret-dev-key-2025';

async function runVerification() {
  const results: TestResult[] = [];

  console.log('\n======================================================');
  console.log('PHASE 6I.4 — MERCHANT ROUTE PROTECTION & STORE OWNERSHIP');
  console.log('======================================================\n');

  await initDatabase();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  async function test(num: number, name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ num, name, passed: true, details: 'OK' });
      console.log(`[PASS] Test ${num}: ${name}`);
    } catch (err: any) {
      results.push({ num, name, passed: false, details: err.message || String(err) });
      console.error(`[FAIL] Test ${num}: ${name} -> ${err.message || String(err)}`);
    }
  }

  const timestamp = Date.now();

  // Create Merchant A and Store A
  const merchantA = await prisma.merchant.create({
    data: {
      name: `Merchant 6I4 Alpha ${timestamp}`,
      email: `merchant-6i4-a-${timestamp}@example.com`,
      store: {
        create: {
          name: `Store 6I4 Alpha ${timestamp}`,
          slug: `store-6i4-alpha-${timestamp}`,
          status: 'PUBLISHED',
        },
      },
    },
    include: { store: true },
  });
  const storeA = merchantA.store!;

  // Create Merchant B and Store B
  const merchantB = await prisma.merchant.create({
    data: {
      name: `Merchant 6I4 Beta ${timestamp}`,
      email: `merchant-6i4-b-${timestamp}@example.com`,
      store: {
        create: {
          name: `Store 6I4 Beta ${timestamp}`,
          slug: `store-6i4-beta-${timestamp}`,
          status: 'PUBLISHED',
        },
      },
    },
    include: { store: true },
  });
  const storeB = merchantB.store!;

  // Create Product A for Store A and Product B for Store B
  const productA = await prisma.product.create({
    data: {
      storeId: storeA.id,
      name: `Product A ${timestamp}`,
      category: 'Electronics',
      price: 1500,
      costPrice: 900,
      stock: 20,
      status: 'PUBLISHED',
    },
  });

  const productB = await prisma.product.create({
    data: {
      storeId: storeB.id,
      name: `Product B ${timestamp}`,
      category: 'Electronics',
      price: 2500,
      costPrice: 1600,
      stock: 15,
      status: 'PUBLISHED',
    },
  });

  const tokenA = signMerchantToken(merchantA.id);
  const tokenB = signMerchantToken(merchantB.id);
  const expiredToken = signMerchantToken(merchantA.id, '-1s');
  const invalidToken = 'eyInvalidTokenPayloadSignature.abc.xyz';

  try {
    // 1. Missing JWT on dashboard summary -> 401
    await test(1, 'GET /api/merchant-dashboard/summary without auth returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/merchant-dashboard/summary?storeId=${storeA.id}`);
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      const body = await res.json() as any;
      if (body.success !== false || !body.error?.message) throw new Error(`Expected error response format, got ${JSON.stringify(body)}`);
    });

    // 2. Invalid JWT on dashboard summary -> 401
    await test(2, 'GET /api/merchant-dashboard/summary with invalid token returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/merchant-dashboard/summary?storeId=${storeA.id}`, {
        headers: { Authorization: `Bearer ${invalidToken}` },
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 3. Expired JWT on dashboard summary -> 401
    await test(3, 'GET /api/merchant-dashboard/summary with expired token returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/merchant-dashboard/summary?storeId=${storeA.id}`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 4. Valid JWT on own store dashboard summary -> 200
    await test(4, 'GET /api/merchant-dashboard/summary with valid JWT for own store returns 200', async () => {
      const res = await fetch(`${baseUrl}/api/merchant-dashboard/summary?storeId=${storeA.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json() as any;
      if (!body.success || !body.data) throw new Error('Expected success response with data');
    });

    // 5. Valid JWT for Merchant A accessing Store B summary -> 403
    await test(5, 'GET /api/merchant-dashboard/summary for another merchant store returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/merchant-dashboard/summary?storeId=${storeB.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      const body = await res.json() as any;
      if (body.success !== false || !body.error?.message) throw new Error(`Expected error response format, got ${JSON.stringify(body)}`);
    });

    // 6. Cross-merchant dashboard access blocked on /funnel, /attribution, /insights -> 403
    await test(6, 'All dashboard routes reject cross-merchant storeId with 403', async () => {
      for (const endpoint of ['funnel', 'attribution', 'insights']) {
        const res = await fetch(`${baseUrl}/api/merchant-dashboard/${endpoint}?storeId=${storeB.id}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });
        if (res.status !== 403) throw new Error(`Expected 403 on ${endpoint}, got ${res.status}`);
      }
    });

    // 7. Missing JWT on POST /api/products -> 401
    await test(7, 'POST /api/products without auth returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: storeA.id, name: 'Test Prod', price: 100, costPrice: 50 }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 8. Valid JWT POST /api/products for own store -> 201
    let createdProductAId = '';
    await test(8, 'POST /api/products with valid JWT for own store returns 201', async () => {
      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          storeId: storeA.id,
          name: 'Prod A Valid',
          price: 999,
          costPrice: 500,
          category: 'Electronics',
        }),
      });
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const body = await res.json() as any;
      createdProductAId = body.data.id;
    });

    // 9. Valid JWT for Merchant A attempting POST /api/products for Store B -> 403
    await test(9, 'POST /api/products targeting another merchant storeId returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          storeId: storeB.id,
          name: 'Sneaky Prod',
          price: 999,
          costPrice: 500,
          category: 'Electronics',
        }),
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // 10. Missing JWT on PUT /api/products/:id -> 401
    await test(10, 'PUT /api/products/:id without auth returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/products/${productA.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 11. Valid JWT PUT /api/products/:id for own product -> 200
    await test(11, 'PUT /api/products/:id with valid JWT for own product returns 200', async () => {
      const res = await fetch(`${baseUrl}/api/products/${productA.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ name: 'Product A Updated Name', price: 1600 }),
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    // 12. Valid JWT for Merchant A attempting PUT /api/products/:id on Product B -> 403
    await test(12, 'PUT /api/products/:id for another merchant product returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/products/${productB.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ name: 'Hacked Product B' }),
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // 13. Forged storeId in PUT body cannot bypass DB product ownership check
    await test(13, 'Forged storeId in PUT body cannot bypass server-side ownership verification', async () => {
      const res = await fetch(`${baseUrl}/api/products/${productB.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ storeId: storeA.id, name: 'Forged Body StoreId' }),
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // 14. Missing JWT on PATCH /api/products/:id/status -> 401
    await test(14, 'PATCH /api/products/:id/status without auth returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/products/${productA.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 15. Valid JWT PATCH /api/products/:id/status for own product -> 200
    await test(15, 'PATCH /api/products/:id/status with valid JWT for own product returns 200', async () => {
      const res = await fetch(`${baseUrl}/api/products/${productA.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    // 16. Valid JWT PATCH /api/products/:id/status for another merchant product -> 403
    await test(16, 'PATCH /api/products/:id/status for another merchant product returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/products/${productB.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // 17. Missing JWT on DELETE /api/products/:id -> 401
    await test(17, 'DELETE /api/products/:id without auth returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/products/${createdProductAId}`, {
        method: 'DELETE',
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 18. Valid JWT DELETE /api/products/:id for another merchant product -> 403
    await test(18, 'DELETE /api/products/:id for another merchant product returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/products/${productB.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // 19. Valid JWT DELETE /api/products/:id for own product -> 200
    await test(19, 'DELETE /api/products/:id with valid JWT for own product returns 200', async () => {
      const res = await fetch(`${baseUrl}/api/products/${createdProductAId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    // 20. Missing JWT on PUT /api/stores/:id -> 401
    await test(20, 'PUT /api/stores/:id without auth returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Store Name' }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 21. Valid JWT PUT /api/stores/:id for own store -> 200
    await test(21, 'PUT /api/stores/:id with valid JWT for own store returns 200', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ name: `Store 6I4 Alpha Renamed ${timestamp}` }),
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    // 22. Valid JWT PUT /api/stores/:id for another merchant store -> 403
    await test(22, 'PUT /api/stores/:id for another merchant store returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeB.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ name: 'Hacked Store B' }),
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // 23. Valid JWT PATCH /api/stores/:id/status for another merchant store -> 403
    await test(23, 'PATCH /api/stores/:id/status for another merchant store returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeB.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ status: 'UNPUBLISHED' }),
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // 24. Missing JWT on GET /api/merchants/:id -> 401
    await test(24, 'GET /api/merchants/:id without auth returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/merchants/${merchantA.id}`);
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 25. Valid JWT GET /api/merchants/:id for own profile -> 200 & zero passwordHash
    await test(25, 'GET /api/merchants/:id for own profile returns 200 with zero passwordHash', async () => {
      const res = await fetch(`${baseUrl}/api/merchants/${merchantA.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json() as any;
      if (body.data.id !== merchantA.id) throw new Error('Incorrect merchant returned');
      if (body.data.passwordHash !== undefined || JSON.stringify(body).toLowerCase().includes('passwordhash')) {
        throw new Error('Security Breach: passwordHash leaked in merchant profile!');
      }
    });

    // 26. Valid JWT GET /api/merchants/:id for another merchant profile -> 403
    await test(26, 'GET /api/merchants/:id for another merchant profile returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/merchants/${merchantB.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // 27. Public product GET (/api/products & /api/products/:id) works without auth -> 200
    await test(27, 'Public customer product endpoints remain accessible without auth', async () => {
      const listRes = await fetch(`${baseUrl}/api/products?storeId=${storeA.id}`);
      if (listRes.status !== 200) throw new Error(`Expected 200 for products list, got ${listRes.status}`);

      const singleRes = await fetch(`${baseUrl}/api/products/${productA.id}`);
      if (singleRes.status !== 200) throw new Error(`Expected 200 for single product, got ${singleRes.status}`);
    });

    // 28. Public store GET (/api/stores/:slug) works without auth -> 200
    await test(28, 'Public store by slug endpoint remains accessible without auth', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA.slug}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    // 29. Client merchantId in query/body cannot override JWT identity
    await test(29, 'Client cannot override JWT identity using body/query parameters', async () => {
      // Merchant A tries to claim merchant B's identity in dashboard request query
      const res = await fetch(`${baseUrl}/api/merchant-dashboard/summary?storeId=${storeB.id}&merchantId=${merchantB.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (res.status !== 403) throw new Error(`Expected 403 despite spoofed merchantId query param, got ${res.status}`);
    });

    // 30. Customer cart / guest checkout remains functional without merchant auth
    await test(30, 'Customer cart endpoints remain functional without merchant auth', async () => {
      const cartRes = await fetch(`${baseUrl}/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: `sess_cart_${timestamp}`, productId: productA.id, quantity: 1 }),
      });
      // Cart might return 200/201 or 400 if validation differs, but NOT 401/403
      if (cartRes.status === 401 || cartRes.status === 403) {
        throw new Error(`Customer cart returned merchant auth error: ${cartRes.status}`);
      }
    });
  } finally {
    // Cleanup
    try {
      await prisma.product.deleteMany({ where: { storeId: { in: [storeA.id, storeB.id] } } });
      await prisma.store.deleteMany({ where: { id: { in: [storeA.id, storeB.id] } } });
      await prisma.merchant.deleteMany({ where: { id: { in: [merchantA.id, merchantB.id] } } });
    } catch {
      // Ignore cleanup error
    }
    server.close();
    await prisma.$disconnect();
  }

  // Summary
  console.log('\n======================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`VERIFICATION SUMMARY: ${passed}/${results.length} tests passed (${failed} failed)`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error(`FAILED TESTS: ${results.filter((r) => !r.passed).map((f) => f.num).join(', ')}`);
    process.exit(1);
  } else {
    console.log('ALL PHASE 6I.4 TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

runVerification().catch(async (err) => {
  console.error('Test execution error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
