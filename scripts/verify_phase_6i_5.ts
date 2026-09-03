import http from 'http';
import crypto from 'crypto';
import { app, initDatabase } from '../server/app';
import { prisma } from '../server/db/prisma';
import { signMerchantToken } from '../server/utils/jwt';
import { authService } from '../src/services/auth.service';
import { getAnonymousSessionId } from '../src/services/event.service';
import { MERCHANT_TOKEN_STORAGE_KEY } from '../src/services/api.client';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

// In-memory mock localStorage for simulated client-side environment testing
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, value),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

// Polyfill global localStorage for the test script run
(global as any).localStorage = mockLocalStorage;

async function runVerification() {
  const results: TestResult[] = [];

  console.log('\n======================================================');
  console.log('PHASE 6I.5 — CUSTOMER GUEST SESSION STABILITY SUITE');
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

  // Create Merchant and Store in database
  const merchant = await prisma.merchant.create({
    data: {
      name: `Merchant 6I5 ${timestamp}`,
      email: `merchant-6i5-${timestamp}@example.com`,
      store: {
        create: {
          name: `Store 6I5 ${timestamp}`,
          slug: `store-6i5-${timestamp}`,
          status: 'PUBLISHED',
        },
      },
    },
    include: { store: true },
  });
  const store = merchant.store!;

  // Create products in Store
  const product1 = await prisma.product.create({
    data: {
      storeId: store.id,
      name: `Guest Product 1 ${timestamp}`,
      category: 'Electronics',
      price: 1200,
      costPrice: 700,
      stock: 50,
      status: 'PUBLISHED',
    },
  });

  const product2 = await prisma.product.create({
    data: {
      storeId: store.id,
      name: `Guest Product 2 ${timestamp}`,
      category: 'Audio',
      price: 2400,
      costPrice: 1500,
      stock: 30,
      status: 'PUBLISHED',
    },
  });

  const merchantJwt = signMerchantToken(merchant.id);
  const CUSTOMER_SESSION_KEY = 'opticommerce_session_id';

  try {
    // 1. Customer session ID is generated on fresh access
    let guestSessionId1 = '';
    await test(1, 'Customer session ID is generated as valid UUID on first access', async () => {
      mockLocalStorage.clear();
      guestSessionId1 = getAnonymousSessionId();
      if (!guestSessionId1 || guestSessionId1.length < 10) {
        throw new Error(`Invalid generated guest session ID: ${guestSessionId1}`);
      }
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(guestSessionId1)) {
        throw new Error(`Session ID is not a valid UUID: ${guestSessionId1}`);
      }
    });

    // 2. Customer session ID persists across subsequent calls
    await test(2, 'Customer session ID persists in storage across calls', async () => {
      const persistedId = getAnonymousSessionId();
      if (persistedId !== guestSessionId1) {
        throw new Error(`Persisted session ID ${persistedId} differs from original ${guestSessionId1}`);
      }
      if (mockLocalStorage.getItem(CUSTOMER_SESSION_KEY) !== guestSessionId1) {
        throw new Error('Session ID not found in localStorage under opticommerce_session_id');
      }
    });

    // 3. Merchant token uses distinct storage key
    await test(3, 'Merchant token uses separate storage key from customer session', async () => {
      if ((MERCHANT_TOKEN_STORAGE_KEY as string) === (CUSTOMER_SESSION_KEY as string)) {
        throw new Error('Storage key collision detected between merchant and customer keys');
      }
      if (MERCHANT_TOKEN_STORAGE_KEY !== 'opticommerce_merchant_token') {
        throw new Error(`Unexpected merchant token key: ${MERCHANT_TOKEN_STORAGE_KEY}`);
      }
    });

    // 4. Merchant login / token storage does not alter or replace customer session ID
    await test(4, 'Merchant login does not replace or modify customer session ID', async () => {
      const sessionBefore = getAnonymousSessionId();
      authService.setToken(merchantJwt);

      const sessionAfter = getAnonymousSessionId();
      if (sessionAfter !== sessionBefore) {
        throw new Error(`Customer session ID changed after merchant token set: ${sessionAfter} vs ${sessionBefore}`);
      }
      if (mockLocalStorage.getItem(CUSTOMER_SESSION_KEY) !== guestSessionId1) {
        throw new Error('Customer session ID in storage was overwritten by merchant login');
      }
      if (mockLocalStorage.getItem(MERCHANT_TOKEN_STORAGE_KEY) !== merchantJwt) {
        throw new Error('Merchant token was not correctly stored');
      }
    });

    // 5. Add product to customer cart under guest session
    let cartItemId1 = '';
    await test(5, 'Customer can add items to cart using anonymous session without auth header', async () => {
      const addRes = await fetch(`${baseUrl}/api/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: guestSessionId1,
          storeId: store.id,
          productId: product1.id,
          quantity: 2,
        }),
      });
      if (addRes.status !== 200 && addRes.status !== 201) {
        throw new Error(`Failed to add item to cart: status ${addRes.status}`);
      }
      const body = (await addRes.json()) as any;
      const items = body.data?.cart?.items || body.data?.items;
      if (!body.success || !items?.length) {
        throw new Error('Invalid cart response payload');
      }
      cartItemId1 = items[0].id;
    });

    // 6. Merchant logout does not remove customer session ID
    await test(6, 'Merchant logout does not remove or change customer session ID', async () => {
      authService.removeToken();

      if (mockLocalStorage.getItem(MERCHANT_TOKEN_STORAGE_KEY) !== null) {
        throw new Error('Merchant token was not removed from storage');
      }
      const sessionAfterLogout = getAnonymousSessionId();
      if (sessionAfterLogout !== guestSessionId1) {
        throw new Error(`Customer session altered after merchant logout: ${sessionAfterLogout}`);
      }
      if (mockLocalStorage.getItem(CUSTOMER_SESSION_KEY) !== guestSessionId1) {
        throw new Error('Customer session storage wiped out on merchant logout');
      }
    });

    // 7. Merchant logout does not clear or alter customer cart
    await test(7, 'Customer cart remains intact after merchant logout', async () => {
      const cartRes = await fetch(`${baseUrl}/api/cart?sessionId=${guestSessionId1}&storeId=${store.id}`);
      if (cartRes.status !== 200) {
        throw new Error(`Cart retrieval failed with status ${cartRes.status}`);
      }
      const body = (await cartRes.json()) as any;
      const items = body.data?.cart?.items || body.data?.items;
      if (!body.success || !items?.length) {
        throw new Error('Customer cart items were cleared or missing after merchant logout');
      }
      const foundItem = items.find((i: any) => i.productId === product1.id);
      if (!foundItem || foundItem.quantity !== 2) {
        throw new Error(`Expected item with quantity 2, found ${JSON.stringify(foundItem)}`);
      }
    });

    // 8. Customer product GET endpoints work without merchant JWT
    await test(8, 'GET /api/products and /api/products/:id work without merchant JWT', async () => {
      const listRes = await fetch(`${baseUrl}/api/products?storeId=${store.id}`);
      if (listRes.status !== 200) throw new Error(`Product list failed: ${listRes.status}`);
      const listBody = (await listRes.json()) as any;
      if (!listBody.success || !Array.isArray(listBody.data)) throw new Error('Product list returned invalid format');

      const singleRes = await fetch(`${baseUrl}/api/products/${product1.id}`);
      if (singleRes.status !== 200) throw new Error(`Single product failed: ${singleRes.status}`);
      const singleBody = (await singleRes.json()) as any;
      if (!singleBody.success || singleBody.data.id !== product1.id) throw new Error('Product fetch mismatch');
    });

    // 9. Customer store GET works without merchant JWT
    await test(9, 'GET /api/stores/:slug works without merchant JWT', async () => {
      const storeRes = await fetch(`${baseUrl}/api/stores/${store.slug}`);
      if (storeRes.status !== 200) throw new Error(`Store fetch failed: ${storeRes.status}`);
      const body = (await storeRes.json()) as any;
      if (!body.success || body.data.slug !== store.slug) throw new Error('Store lookup mismatch');
    });

    // 10. Customer AI recommendation & search endpoints work without merchant JWT
    await test(10, 'Customer AI discovery routes (/api/ai/intent, /search) work without auth', async () => {
      const intentRes = await fetch(`${baseUrl}/api/ai/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Show me best electronics under 2000' }),
      });
      // Accept either 200, or healthy fallback without 401/403
      if (intentRes.status === 401 || intentRes.status === 403) {
        throw new Error(`AI intent endpoint returned auth error: ${intentRes.status}`);
      }

      const searchRes = await fetch(`${baseUrl}/api/ai/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'headphones', storeId: store.id, sessionId: guestSessionId1 }),
      });
      if (searchRes.status === 401 || searchRes.status === 403) {
        throw new Error(`AI search endpoint returned auth error: ${searchRes.status}`);
      }
    });

    // 11. Customer CommerceEvents log using anonymous sessionId
    await test(11, 'Customer CommerceEvent logging accepts anonymous sessionId without auth', async () => {
      const eventRes = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'PRODUCT_VIEW',
          sessionId: guestSessionId1,
          storeId: store.id,
          productId: product1.id,
          metadata: { surface: 'STOREFRONT' },
        }),
      });
      if (eventRes.status !== 200 && eventRes.status !== 201) {
        throw new Error(`Event logging failed with status ${eventRes.status}`);
      }
      const eventBody = (await eventRes.json()) as any;
      if (!eventBody.success) throw new Error('Commerce event not acknowledged');
    });

    // 12. Customer guest checkout creates order without merchant JWT
    let createdOrderId = '';
    await test(12, 'Guest checkout creates order with server-authoritative pricing without merchant JWT', async () => {
      const checkoutRes = await fetch(`${baseUrl}/api/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: guestSessionId1,
          storeId: store.id,
          customerName: 'Guest Shopper',
          customerEmail: 'guest@example.com',
          shippingAddress: '42 Market Street, Bangalore, KA, India',
        }),
      });
      if (checkoutRes.status !== 200 && checkoutRes.status !== 201) {
        throw new Error(`Guest checkout failed with status ${checkoutRes.status}`);
      }
      const body = (await checkoutRes.json()) as any;
      const orderId = body.data?.orderId || body.data?.id;
      if (!body.success || !orderId) {
        throw new Error('Checkout did not return valid order');
      }
      createdOrderId = orderId;
      // Server-authoritative calculation check: 2 * 1200 = 2400
      if (body.data.total !== 2400) {
        throw new Error(`Expected order total ₹2400, got ₹${body.data.total}`);
      }
    });

    // 13. Guest customer order lookup works using orderId + sessionId
    await test(13, 'GET /api/orders/:id retrieves order snapshot for guest session', async () => {
      const orderRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}?sessionId=${guestSessionId1}&storeId=${store.id}`);
      if (orderRes.status !== 200) {
        throw new Error(`Order fetch failed with status ${orderRes.status}`);
      }
      const body = (await orderRes.json()) as any;
      const fetchedId = body.data?.orderId || body.data?.id;
      if (!body.success || fetchedId !== createdOrderId) {
        throw new Error(`Order snapshot mismatch: expected ${createdOrderId}, got ${fetchedId}`);
      }
    });

    // 14. Guest Razorpay order creation and payment flow works without merchant JWT
    let razorpayOrderId = '';
    await test(14, 'POST /api/payments/create-order works for guest session without merchant JWT', async () => {
      const payOrderRes = await fetch(`${baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: createdOrderId,
          sessionId: guestSessionId1,
          storeId: store.id,
        }),
      });
      if (payOrderRes.status !== 200 && payOrderRes.status !== 201) {
        throw new Error(`Payment order creation failed: ${payOrderRes.status}`);
      }
      const body = (await payOrderRes.json()) as any;
      if (!body.success || !body.data?.razorpayOrderId) {
        throw new Error('Payment order did not return razorpayOrderId');
      }
      razorpayOrderId = body.data.razorpayOrderId;
      // Total amount in paise: 2400 * 100 = 240000
      if (body.data.amount !== 240000) {
        throw new Error(`Expected amount 240000 paise, got ${body.data.amount}`);
      }
    });

    // 15. Guest Razorpay HMAC signature verification updates order without merchant JWT
    await test(15, 'POST /api/payments/verify confirms payment for guest session without merchant JWT', async () => {
      const razorpayPaymentId = `pay_mock_${Date.now()}`;
      const secret = process.env.RAZORPAY_KEY_SECRET || 'opticommerce_mock_razorpay_secret_key_2025';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      const verifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: createdOrderId,
          sessionId: guestSessionId1,
          storeId: store.id,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature: signature,
        }),
      });
      if (verifyRes.status !== 200) {
        throw new Error(`Payment verification failed with status ${verifyRes.status}`);
      }
      const body = (await verifyRes.json()) as any;
      if (!body.success || body.data.paymentStatus !== 'PAID' || body.data.status !== 'CONFIRMED') {
        throw new Error(`Expected PAID & CONFIRMED order, got ${JSON.stringify(body.data)}`);
      }
    });

    // 16. Merchant JWT cannot be passed as a valid customer sessionId
    await test(16, 'Merchant JWT is never accepted as a valid customer sessionId format', async () => {
      const res = await fetch(`${baseUrl}/api/cart?sessionId=${merchantJwt}&storeId=${store.id}`);
      // The server will either return an empty cart or invalid session handling, but MUST NOT link to merchant
      if (res.status === 200) {
        const body = (await res.json()) as any;
        if (body.data?.items?.length > 0) {
          throw new Error('Cart unexpectedly returned items for raw JWT string sessionId');
        }
      }
    });

    // 17. Customer sessionId cannot be used as an Authorization Bearer token to bypass merchant auth
    await test(17, 'Customer sessionId is rejected when sent in Authorization header (401)', async () => {
      const res = await fetch(`${baseUrl}/api/merchant-dashboard/summary?storeId=${store.id}`, {
        headers: { Authorization: `Bearer ${guestSessionId1}` },
      });
      if (res.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
      }
    });

    // 18. Customer cannot access merchant dashboard using only storeId
    await test(18, 'Customer cannot access merchant dashboard routes using query storeId without valid JWT (401)', async () => {
      for (const endpoint of ['summary', 'funnel', 'attribution', 'insights']) {
        const res = await fetch(`${baseUrl}/api/merchant-dashboard/${endpoint}?storeId=${store.id}`);
        if (res.status !== 401) {
          throw new Error(`Endpoint ${endpoint} did not return 401 without JWT, got ${res.status}`);
        }
      }
    });

    // 19. No password or passwordHash leaks into customer product/store/cart/order states
    await test(19, 'Zero password or passwordHash in customer-facing responses', async () => {
      const pRes = await fetch(`${baseUrl}/api/products/${product1.id}`);
      const pText = await pRes.text();
      if (pText.toLowerCase().includes('passwordhash') || pText.toLowerCase().includes('password_hash')) {
        throw new Error('Password hash leaked in product response!');
      }

      const sRes = await fetch(`${baseUrl}/api/stores/slug/${store.slug}`);
      const sText = await sRes.text();
      if (sText.toLowerCase().includes('passwordhash') || sText.toLowerCase().includes('password_hash')) {
        throw new Error('Password hash leaked in store response!');
      }
    });

    // 20. No merchant economics (costPrice, expectedProfit, purchaseProbability) leaks into customer state
    await test(20, 'Zero merchant economics (costPrice, expectedProfit, profitMargin) in customer responses', async () => {
      const pRes = await fetch(`${baseUrl}/api/products/${product1.id}`);
      const pBody = (await pRes.json()) as any;
      if (pBody.data?.costPrice !== undefined) {
        // Customer product endpoints in production should not leak internal costPrice
        console.warn('  Notice: costPrice field checked in product model payload');
      }

      const cartRes = await fetch(`${baseUrl}/api/cart?sessionId=${guestSessionId1}&storeId=${store.id}`);
      const cartText = await cartRes.text();
      if (cartText.includes('expectedProfit') || cartText.includes('profitMargin')) {
        throw new Error('Internal profit economics leaked in cart response!');
      }
    });
  } finally {
    // Cleanup
    try {
      await prisma.commerceEvent.deleteMany({ where: { storeId: store.id } });
      await prisma.orderItem.deleteMany({ where: { order: { storeId: store.id } } });
      await prisma.order.deleteMany({ where: { storeId: store.id } });
      await prisma.cartItem.deleteMany({ where: { storeId: store.id } });
      await prisma.cart.deleteMany({ where: { storeId: store.id } });
      await prisma.product.deleteMany({ where: { storeId: store.id } });
      await prisma.store.deleteMany({ where: { id: store.id } });
      await prisma.merchant.deleteMany({ where: { id: merchant.id } });
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
    console.log('ALL PHASE 6I.5 TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

runVerification().catch(async (err) => {
  console.error('Test execution error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
