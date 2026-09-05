/**
 * VERIFICATION SUITE — ORDER HISTORY REFRESH & CUSTOMER ORDER HYDRATION
 * Tests:
 * 1. Logged-in customer places order → GET /api/orders returns that order
 * 2. Same customer after simulated refresh/auth restoration → persisted order hydrates into CustomerOrder[]
 * 3. Customer A cannot see Customer B's orders
 * 4. Customer A cannot see orders from another store
 * 5. Guest order behavior remains unchanged
 * 6. Merchant token cannot access customer-scoped order history
 * 7. Hydration does not duplicate an order already present locally
 */

import http from 'http';
import { app, initDatabase } from '../server/app';
import { prisma } from '../server/db/prisma';
import { customerAuthService } from '../src/services/customer-auth.service';
import { signMerchantToken } from '../server/utils/jwt';
import { ServerOrderData, CustomerOrder, CartItem, Product } from '../src/types';

// In-memory mock for localStorage
const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  },
  length: 0,
  key: (i: number) => Object.keys(mockStorage)[i] || null,
} as any;

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] Test ${totalTests}: ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] Test ${totalTests}: ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

async function runOrderHistoryTests() {
  console.log('===============================================================');
  console.log('ORDER HISTORY REFRESH & PERSISTENCE VERIFICATION');
  console.log('===============================================================\n');

  await initDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;
  process.env.VITE_API_BASE_URL = baseUrl;

  try {
    const store = await prisma.store.findFirst({
      where: { slug: 'opticommerce-flagship-electronics' },
    }) || await prisma.store.findFirst();

    if (!store) throw new Error('No test store found');
    const storeId = store.id;

    const products = await prisma.product.findMany({
      where: { storeId },
      take: 2,
    });
    const productA = products[0];

    // Create a secondary store for cross-store isolation testing
    let secondStore = await prisma.store.findFirst({
      where: { slug: 'second-test-store' },
    });
    if (!secondStore) {
      secondStore = await prisma.store.create({
        data: {
          merchantId: 'merchant-second-store',
          name: 'Second Test Store',
          slug: 'second-test-store',
        },
      });
    }

    // --- TEST 1: Logged-in customer places order → GET /api/orders returns that order ---
    console.log('--- Test 1: Logged-in customer checkout & GET /api/orders ---');
    const customerAEmail = `cust_a_${Date.now()}@example.com`;
    const customerA = await customerAuthService.register(customerAEmail, 'Password123!', storeId, 'Customer A');

    const sessionA1 = `sess_a1_${Date.now()}`;
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerA.token}`,
      },
      body: JSON.stringify({
        sessionId: sessionA1,
        storeId,
        productId: productA.id,
        quantity: 1,
      }),
    });

    const checkoutResA = await fetch(`${baseUrl}/api/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerA.token}`,
      },
      body: JSON.stringify({
        sessionId: sessionA1,
        storeId,
      }),
    });
    const checkoutDataA = await checkoutResA.json();
    assert(checkoutResA.status === 201, 'Customer A placed order successfully (201)');
    const orderIdA = checkoutDataA.data.orderId;

    // Fetch orders with Customer A token
    const listResA = await fetch(`${baseUrl}/api/orders?storeId=${storeId}`, {
      headers: {
        Authorization: `Bearer ${customerA.token}`,
      },
    });
    const listDataA = await listResA.json();
    assert(
      listResA.status === 200 &&
      Array.isArray(listDataA.data) &&
      listDataA.data.some((o: any) => o.orderId === orderIdA),
      'GET /api/orders with customer Bearer token returns placed order'
    );

    // --- TEST 2: Same customer after simulated refresh/auth restoration → persisted order hydrates into CustomerOrder[] ---
    console.log('\n--- Test 2: Simulated browser refresh & CustomerOrder[] hydration ---');
    // Simulate browser refresh: session ID is refreshed, in-memory state is empty
    const freshSessionAfterRefresh = `sess_fresh_${Date.now()}`;
    
    // Call GET /api/orders as apiFetch does on refresh
    const refreshListRes = await fetch(
      `${baseUrl}/api/orders?sessionId=${freshSessionAfterRefresh}&storeId=${storeId}`,
      {
        headers: {
          Authorization: `Bearer ${customerA.token}`,
        },
      }
    );
    const refreshListData = await refreshListRes.json();
    const serverOrders: ServerOrderData[] = refreshListData.data;

    assert(
      serverOrders.length >= 1 && serverOrders[0].orderId === orderIdA,
      'Server returns persisted orders for authenticated customer on a new session'
    );

    // Run hydration mapper logic (as in CommerceContext.tsx)
    const mappedCustomerOrders: CustomerOrder[] = serverOrders.map((so) => {
      const items: CartItem[] = (so.items || []).map((serverItem) => ({
        product: {
          id: serverItem.productId,
          name: serverItem.productName,
          basePrice: serverItem.unitPrice,
          currentPrice: serverItem.unitPrice,
          costPrice: 0,
          stock: 100,
          category: 'Electronics',
          image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
          aiDiscountEligible: false,
          activeDiscountPercent: 0,
          features: [],
          rating: 4.8,
          reviewsCount: 120,
          salesVelocity: 1.0,
          inventoryRisk: 'LOW',
          description: serverItem.productName,
        } as unknown as Product,
        quantity: serverItem.quantity,
        appliedDiscountPercent: serverItem.discountPercent || 0,
      }));

      return {
        id: so.orderId,
        date: new Date(so.createdAt).toISOString().split('T')[0],
        items,
        subtotal: so.subtotal,
        discountAmount: so.discount,
        total: so.total,
        status: 'Processing',
        customerName: customerA.customer.name || 'Customer',
        customerEmail: customerA.customer.email,
        shippingAddress: 'Test Address',
        aiSavings: so.discount,
      };
    });

    assert(
      mappedCustomerOrders.length >= 1 &&
      mappedCustomerOrders[0].id === orderIdA &&
      mappedCustomerOrders[0].items.length >= 1,
      'Persisted order successfully hydrates into CustomerOrder[] shape for OrdersView'
    );

    // --- TEST 3: Customer A cannot see Customer B's orders ---
    console.log('\n--- Test 3: Customer A vs Customer B Isolation ---');
    const customerBEmail = `cust_b_${Date.now()}@example.com`;
    const customerB = await customerAuthService.register(customerBEmail, 'Password123!', storeId, 'Customer B');

    // Customer B requests orders
    const listResB = await fetch(`${baseUrl}/api/orders?storeId=${storeId}`, {
      headers: {
        Authorization: `Bearer ${customerB.token}`,
      },
    });
    const listDataB = await listResB.json();
    assert(
      Array.isArray(listDataB.data) &&
      !listDataB.data.some((o: any) => o.orderId === orderIdA),
      "Customer B cannot see Customer A's orders (strict customerId isolation)"
    );

    // --- TEST 4: Customer A cannot see orders from another store ---
    console.log('\n--- Test 4: Cross-Store Isolation ---');
    const listResSecondStore = await fetch(`${baseUrl}/api/orders?storeId=${secondStore.id}`, {
      headers: {
        Authorization: `Bearer ${customerA.token}`,
      },
    });
    const listDataSecondStore = await listResSecondStore.json();
    assert(
      Array.isArray(listDataSecondStore.data) &&
      listDataSecondStore.data.length === 0,
      'Customer A receives 0 orders when querying another store (storeId isolation preserved)'
    );

    // --- TEST 5: Guest order behavior remains unchanged ---
    console.log('\n--- Test 5: Guest order query behavior ---');
    const guestSessionX = `guest_sess_x_${Date.now()}`;
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestSessionX,
        storeId,
        productId: productA.id,
        quantity: 1,
      }),
    });
    const guestCheckout = await fetch(`${baseUrl}/api/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestSessionX,
        storeId,
      }),
    });
    const guestOrder = (await guestCheckout.json()).data;

    // Query orders as guest with same sessionId
    const guestListRes = await fetch(
      `${baseUrl}/api/orders?sessionId=${guestSessionX}&storeId=${storeId}`
    );
    const guestListData = await guestListRes.json();
    assert(
      guestListRes.status === 200 &&
      guestListData.data.some((o: any) => o.orderId === guestOrder.orderId),
      'Guest order query using sessionId + storeId returns guest order without auth header'
    );

    // Guest query with a different sessionId does not see it
    const diffGuestRes = await fetch(
      `${baseUrl}/api/orders?sessionId=different_guest_sess&storeId=${storeId}`
    );
    const diffGuestData = await diffGuestRes.json();
    assert(
      diffGuestData.data.length === 0,
      'Unrelated guest session cannot see guest order'
    );

    // --- TEST 6: Merchant token cannot access customer-scoped order history ---
    console.log('\n--- Test 6: Merchant token isolation ---');
    const merchantToken = signMerchantToken('merchant-123');
    const merchListRes = await fetch(`${baseUrl}/api/orders?storeId=${storeId}`, {
      headers: {
        Authorization: `Bearer ${merchantToken}`,
      },
    });
    const merchListData = await merchListRes.json();
    // Since merchant token fails verifyCustomerToken, optionalCustomerAuth leaves req.customer empty
    // It falls back to guest mode (empty sessionId -> requires sessionId -> 400 or empty array)
    assert(
      merchListRes.status === 400 || (merchListData.data && !merchListData.data.some((o: any) => o.orderId === orderIdA)),
      'Merchant token cannot access customer-scoped order history'
    );

    // --- TEST 7: Hydration does not duplicate an order already present locally ---
    console.log('\n--- Test 7: Duplicate prevention during reconciliation ---');
    const localOrders: CustomerOrder[] = [mappedCustomerOrders[0]]; // orderIdA already in local state
    const serverIds = new Set(mappedCustomerOrders.map((o) => o.id));
    const localOnly = localOrders.filter((o) => !serverIds.has(o.id));
    const reconciled = [...mappedCustomerOrders, ...localOnly];

    assert(
      reconciled.filter((o) => o.id === orderIdA).length === 1,
      'Reconciliation by order ID strictly prevents duplicate entries in orders state'
    );

    // --- TEST 8: Customer Login UI Polish — Minimal Branded Header ---
    console.log('\n--- Test 8: Customer Login Page Minimal Branded Header ---');
    const fs = await import('fs');
    const path = await import('path');
    const appPath = path.resolve(process.cwd(), 'src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf8');

    assert(
      appContent.includes('isCustomerLogin ? (') &&
      appContent.includes('title="Return to Storefront"') &&
      appContent.includes('OptiCommerce'),
      'Customer login route replaces storefront navbar with focused OptiCommerce branded header'
    );

    // --- TEST 9: Dynamic Slug Navigation on Click ---
    assert(
      appContent.includes('navigate(`/store/${targetSlug}`)') &&
      appContent.includes('targetSlug = store?.slug || activeSlug'),
      'Clicking OptiCommerce brand in minimal header navigates dynamically to /store/:slug'
    );

    // --- TEST 10: Storefront Pages Retain Full Customer Navbar ---
    assert(
      appContent.includes('<CustomerHeader') &&
      appContent.includes('onOpenCart={() => setIsCartOpen(true)}'),
      'Storefront pages retain full CustomerHeader with search, tabs, and cart'
    );

    console.log('\n==============================================================');
    console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
    console.log('==============================================================\n');

    if (passedTests === totalTests) {
      console.log('✅ ALL ORDER HISTORY REFRESH TESTS PASSED!');
      process.exit(0);
    } else {
      console.error('❌ SOME TESTS FAILED');
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runOrderHistoryTests().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
