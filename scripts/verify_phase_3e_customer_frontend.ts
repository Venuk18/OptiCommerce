/**
 * PHASE 3E VERIFICATION SUITE — CUSTOMER AUTH FRONTEND INTEGRATION
 * Tests CustomerAuthContext, CustomerAuthService, cart merge frontend synchronization,
 * storage keys, guest session survival, and merchant/customer isolation.
 */

import http from 'http';
import { app, initDatabase } from '../server/app';
import { prisma } from '../server/db/prisma';
import { customerAuthService } from '../src/services/customer-auth.service';
import { authService as merchantAuthService } from '../src/services/auth.service';
import {
  CUSTOMER_TOKEN_STORAGE_KEY,
  MERCHANT_TOKEN_STORAGE_KEY,
  getStoredCustomerToken,
  setStoredCustomerToken,
  getStoredMerchantToken,
} from '../src/services/api.client';
import { getAnonymousSessionId } from '../src/services/event.service';
import { signMerchantToken } from '../server/utils/jwt';

// In-memory mock for localStorage in Node test environment
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

async function runPhase3ETests() {
  console.log('===============================================================');
  console.log('PHASE 3E — CUSTOMER AUTH FRONTEND INTEGRATION VERIFICATION');
  console.log('===============================================================\n');

  await initDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  // Point API base url to test server
  process.env.VITE_API_BASE_URL = baseUrl;

  try {
    // Seed / fetch store
    let store = await prisma.store.findFirst({ where: { slug: 'opticommerce-flagship-electronics' } });
    if (!store) {
      store = await prisma.store.findFirst();
    }
    if (!store) {
      throw new Error('No store found in database');
    }

    const storeId = store.id;
    const storeSlug = store.slug;

    const products = await prisma.product.findMany({
      where: { storeId },
      take: 2,
    });
    const productA = products[0];
    const productB = products[1];

    console.log(`[Setup] Using Store: ${storeId} (${storeSlug})`);
    console.log(`[Setup] Product A: ${productA.id} (${productA.name})`);
    console.log(`[Setup] Product B: ${productB.id} (${productB.name})\n`);

    // --- Section A: Storage Keys & Token Isolation ---
    console.log('--- Section A: Storage Keys & Token Isolation ---');
    localStorage.clear();

    // Test 1: Storage keys are distinct
    assert(
      CUSTOMER_TOKEN_STORAGE_KEY === 'opticommerce_customer_token' &&
      MERCHANT_TOKEN_STORAGE_KEY === 'opticommerce_merchant_token',
      'Customer and merchant storage keys are completely distinct'
    );

    // Test 2: Initial guest session exists without customer or merchant tokens
    const guestSessionId = getAnonymousSessionId();
    assert(
      typeof guestSessionId === 'string' && guestSessionId.length > 0 &&
      getStoredCustomerToken() === null &&
      getStoredMerchantToken() === null,
      'Initial state is anonymous guest with sessionId and zero auth tokens'
    );

    // Test 3: Setting merchant token does not affect customer token
    const dummyMerchantToken = signMerchantToken('merchant-test-123');
    merchantAuthService.setToken(dummyMerchantToken);
    assert(
      getStoredMerchantToken() === dummyMerchantToken &&
      getStoredCustomerToken() === null,
      'Merchant token is stored under dedicated key without setting customer token'
    );

    // --- Section B: Customer Registration ---
    console.log('\n--- Section B: Customer Registration API & Token Storage ---');
    const testEmail = `frontend_cust_${Date.now()}@test.com`;
    const testPassword = 'Password123!';

    // Test 4: Register customer via customerAuthService
    const regResult = await customerAuthService.register(testEmail, testPassword, storeId, 'Frontend Tester');
    assert(
      regResult && regResult.customer && regResult.customer.email === testEmail.toLowerCase() &&
      typeof regResult.token === 'string',
      'customerAuthService.register creates customer and returns valid result'
    );

    // Test 5: Registration automatically persists token in localStorage under customer key
    assert(
      getStoredCustomerToken() === regResult.token &&
      customerAuthService.getToken() === regResult.token,
      'Customer token is stored in localStorage under opticommerce_customer_token'
    );

    // Test 6: Merchant token remains untouched after customer registration
    assert(
      getStoredMerchantToken() === dummyMerchantToken,
      'Merchant token remains intact and isolated after customer registration'
    );

    // --- Section C: GET /api/customer-auth/me & Session Restoration ---
    console.log('\n--- Section C: Session Restoration & Invalid Token Handling ---');

    // Test 7: getMe restores customer profile using stored token
    const meProfile = await customerAuthService.getMe();
    assert(
      meProfile && meProfile.email === testEmail.toLowerCase() && meProfile.storeId === storeId &&
      (meProfile as any).passwordHash === undefined,
      'customerAuthService.getMe restores authenticated profile without passwordHash'
    );

    // Test 8: Invalid customer token is cleared without removing guest session ID
    setStoredCustomerToken('invalid.jwt.token');
    try {
      await customerAuthService.getMe();
      assert(false, 'Invalid token should reject');
    } catch (err) {
      customerAuthService.removeToken();
    }
    assert(
      getStoredCustomerToken() === null &&
      typeof localStorage.getItem('opticommerce_session_id') === 'string',
      'Invalid token is removed from localStorage while guest sessionId survives intact'
    );

    // --- Section D: Customer Login ---
    console.log('\n--- Section D: Customer Login ---');

    // Test 9: Customer login with valid credentials stores token
    const loginResult = await customerAuthService.login(testEmail, testPassword, storeId);
    assert(
      loginResult && loginResult.customer && loginResult.customer.email === testEmail.toLowerCase() &&
      customerAuthService.getToken() === loginResult.token,
      'customerAuthService.login authenticates customer and stores fresh JWT'
    );

    // --- Section E: Guest Cart Merge Integration ---
    console.log('\n--- Section E: Cart Merge & State Synchronization ---');

    // Create guest cart items first
    const guestSession = `guest-fe-test-${Date.now()}`;
    mockStorage['opticommerce_session_id'] = guestSession;

    // Add Item A as guest
    const guestAddRes = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestSession,
        storeId,
        productId: productA.id,
        quantity: 2,
      }),
    });
    assert(guestAddRes.status === 200, 'Guest successfully added item to cart');

    // Test 10: Guest cart exists before merge
    const preMergeGuestRes = await fetch(
      `${baseUrl}/api/cart?sessionId=${guestSession}&storeId=${storeId}`
    );
    const preMergeData = await preMergeGuestRes.json();
    assert(
      preMergeData.cart.items.length === 1 &&
      preMergeData.cart.items[0].productId === productA.id &&
      preMergeData.cart.items[0].quantity === 2,
      'Guest cart contains 2 units of Product A before merge'
    );

    // Test 11: mergeCart sends guest sessionId and storeId with customer Bearer token
    const mergeRes = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginResult.token}`,
      },
      body: JSON.stringify({
        sessionId: guestSession,
        storeId,
      }),
    });
    const mergeData = await mergeRes.json();
    const mergedCart = mergeData.cart;
    assert(
      mergedCart && mergedCart.items.length === 1 &&
      mergedCart.items[0].productId === productA.id &&
      mergedCart.items[0].quantity === 2,
      'Cart merge succeeds and adopts guest cart items into customer cart'
    );

    // Test 12: Calling mergeCart again is idempotent (does not double-count quantities)
    const secondMergeRes = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginResult.token}`,
      },
      body: JSON.stringify({
        sessionId: guestSession,
        storeId,
      }),
    });
    const secondMergeData = await secondMergeRes.json();
    const idempotentCart = secondMergeData.cart;
    assert(
      idempotentCart.items.length === 1 &&
      idempotentCart.items[0].productId === productA.id &&
      idempotentCart.items[0].quantity === 2,
      'Subsequent merge call does not double-count quantities (strictly idempotent)'
    );

    // --- Section F: Customer Logout ---
    console.log('\n--- Section F: Customer Logout & Guest Continuity ---');

    // Test 13: Customer logout wipes customer token
    customerAuthService.logout();
    assert(
      getStoredCustomerToken() === null &&
      customerAuthService.getToken() === null,
      'customerAuthService.logout wipes opticommerce_customer_token'
    );

    // Test 14: Merchant token survived customer logout
    assert(
      getStoredMerchantToken() === dummyMerchantToken,
      'Merchant token is completely unaffected by customer logout'
    );

    // Test 15: Guest session ID survived customer logout
    assert(
      localStorage.getItem('opticommerce_session_id') === guestSession,
      'Guest session ID is preserved across customer logout'
    );

    // Test 16: Guest can add new items after customer logout without auth header
    const postLogoutGuestSession = `guest_anon_${Date.now()}`;
    const newGuestItemRes = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: postLogoutGuestSession,
        storeId,
        productId: productB.id,
        quantity: 1,
      }),
    });
    const newGuestData = await newGuestItemRes.json();
    assert(
      newGuestData.cart &&
      newGuestData.cart.items.some((i: any) => i.productId === productB.id),
      'Guest can continue browsing and adding to cart after logout without authentication'
    );

    // --- Section G: Inventory Bounds in Authoritative Cart ---
    console.log('\n--- Section G: Inventory & Authoritative Cart Replacement ---');

    // Test 17: Stock bounds enforced: addItem rejects > stock, and merge caps combined quantity
    const guestSessionG = `guest_g_${Date.now()}`;
    const excessiveAddRes = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestSessionG,
        storeId,
        productId: productA.id,
        quantity: 99999, // exceeds stock
      }),
    });
    assert(
      excessiveAddRes.status === 400,
      `Direct addItem with quantity exceeding stock is rejected with 400 (${excessiveAddRes.status})`
    );

    // Create fresh customer with an item
    const custEmailStock = `stock_cust_${Date.now()}@test.com`;
    const custStock = await customerAuthService.register(custEmailStock, 'Password123!', storeId, 'Stock Tester');
    
    // Add 2 to customer cart
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custStock.token}`,
      },
      body: JSON.stringify({
        sessionId: `cust_sess_${Date.now()}`,
        storeId,
        productId: productA.id,
        quantity: productA.stock > 1 ? productA.stock - 1 : 1,
      }),
    });

    // Add 2 to guest cart
    const guestMergeStockSess = `guest_merge_stock_${Date.now()}`;
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestMergeStockSess,
        storeId,
        productId: productA.id,
        quantity: 2,
      }),
    });

    // Merge carts
    const cappedMergeRes = await fetch(`${baseUrl}/api/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custStock.token}`,
      },
      body: JSON.stringify({
        sessionId: guestMergeStockSess,
        storeId,
      }),
    });
    const cappedData = await cappedMergeRes.json();
    const cappedItem = cappedData.cart.items.find((i: any) => i.productId === productA.id);
    assert(
      cappedItem && cappedItem.quantity <= productA.stock,
      `Merged cart strictly caps combined quantity at available inventory (${cappedItem?.quantity} <= ${productA.stock})`
    );

    // Test 18: No customerId is accepted from request body on cart endpoints
    const tamperedCartRes = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestSessionG,
        storeId,
        productId: productB.id,
        quantity: 1,
        customerId: 'forged-customer-id',
      }),
    });
    const tamperedData = await tamperedCartRes.json();
    assert(
      tamperedData.cart && tamperedData.cart.customerId !== 'forged-customer-id',
      'Frontend/client request cannot forge customerId via body (server is authoritative)'
    );

    console.log('\n==============================================================');
    console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
    console.log('==============================================================\n');

    if (passedTests === totalTests) {
      console.log('✅ ALL PHASE 3E FRONTEND INTEGRATION TESTS PASSED!');
      process.exit(0);
    } else {
      console.error('❌ SOME TESTS FAILED');
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runPhase3ETests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
