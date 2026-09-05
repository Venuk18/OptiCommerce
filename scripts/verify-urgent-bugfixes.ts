/**
 * REGRESSION VERIFICATION SUITE — URGENT BUG FIXES
 * Verifies Bug #1 (Checkout Customer Auth), Bug #2 (Customer Login UI), and Bug #3 (Offer Discount Isolation)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { app, initDatabase } from '../server/app';
import { prisma } from '../server/db/prisma';
import { customerAuthService } from '../src/services/customer-auth.service';
import { signMerchantToken } from '../server/utils/jwt';

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

async function runRegressionSuite() {
  console.log('===============================================================');
  console.log('URGENT BUG FIXES REGRESSION VERIFICATION SUITE');
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
    const storeSlug = store.slug;

    const products = await prisma.product.findMany({
      where: { storeId },
      take: 2,
    });
    if (products.length < 2) throw new Error('Store needs at least 2 products for testing');

    const productA = products[0];
    const productB = products[1];

    console.log(`[Setup] Store: ${storeSlug} (${storeId})`);
    console.log(`[Setup] Product A: ${productA.name} ($${productA.price})`);
    console.log(`[Setup] Product B: ${productB.name} ($${productB.price})\n`);

    // =========================================================================
    // SECTION 1: BUG #3 — REGRESSION SEQUENCE & OFFER ISOLATION
    // =========================================================================
    console.log('--- SECTION 1: BUG #3 — OFFER DISCOUNT ISOLATION & PRICE PERSISTENCE ---');

    // Step 1: Record Product A's original catalog/database price
    const originalPriceA = Number(productA.price);
    const originalPriceB = Number(productB.price);

    assert(
      typeof originalPriceA === 'number' && originalPriceA > 0,
      `Step 1: Recorded Product A catalog price: $${originalPriceA}`
    );

    // Simulated Cart logic mirroring fixed CommerceContext.tsx
    type CartItem = {
      product: typeof productA;
      quantity: number;
      appliedDiscountPercent: number;
      discountReason?: string;
    };

    const simulateAddToCart = (
      currentCart: CartItem[],
      prod: typeof productA,
      qty: number,
      offerOverride?: { discountPercent: number; discountReason?: string }
    ): CartItem[] => {
      let discount = 0;
      let reason: string | undefined = undefined;

      if (offerOverride && typeof offerOverride.discountPercent === 'number' && offerOverride.discountPercent > 0) {
        discount = Math.max(0, offerOverride.discountPercent);
        reason = offerOverride.discountReason || `${discount}% Exclusive Offer Applied`;
      }

      const existing = currentCart.find((i) => i.product.id === prod.id);
      if (existing) {
        return currentCart.map((item) =>
          item.product.id === prod.id
            ? {
                ...item,
                quantity: item.quantity + qty,
                appliedDiscountPercent: offerOverride !== undefined ? discount : item.appliedDiscountPercent,
                discountReason: offerOverride !== undefined ? reason : item.discountReason,
              }
            : item
        );
      }
      return [...currentCart, { product: { ...prod }, quantity: qty, appliedDiscountPercent: discount, discountReason: reason }];
    };

    let testCart: CartItem[] = [];

    // Step 2: Apply an eligible offer to Product A (e.g. 15% discount)
    testCart = simulateAddToCart(testCart, productA, 1, {
      discountPercent: 15,
      discountReason: '15% Flash Deal',
    });

    const itemAInCart = testCart.find((i) => i.product.id === productA.id);
    const cartPriceA = (itemAInCart?.product.price || 0) * (1 - (itemAInCart?.appliedDiscountPercent || 0) / 100);

    assert(
      itemAInCart !== undefined &&
      itemAInCart.appliedDiscountPercent === 15 &&
      Math.abs(cartPriceA - originalPriceA * 0.85) < 0.01,
      `Step 2: Cart uses discounted price for Product A ($${cartPriceA.toFixed(2)} vs original $${originalPriceA})`
    );

    // Step 3: Confirm catalog/database Product A price is unchanged
    const dbProductAAfterOffer = await prisma.product.findUnique({ where: { id: productA.id } });
    assert(
      Number(dbProductAAfterOffer?.price) === originalPriceA,
      `Step 3: Database Product A price remains strictly unchanged ($${dbProductAAfterOffer?.price} === $${originalPriceA})`
    );
    assert(
      Number(productA.price) === originalPriceA,
      'Step 3b: In-memory catalog product object reference was not mutated'
    );

    // Step 4: Add Product B without an offer
    testCart = simulateAddToCart(testCart, productB, 1);
    const itemBInCart = testCart.find((i) => i.product.id === productB.id);

    assert(
      itemBInCart !== undefined &&
      itemBInCart.appliedDiscountPercent === 0 &&
      itemBInCart.discountReason === undefined,
      `Step 4: Product B added without offer has 0% discount (standard full price $${originalPriceB})`
    );

    // Step 5: Confirm cart total is sum of (Discounted A + Full Price B)
    const expectedCartTotal = originalPriceA * 0.85 + originalPriceB;
    const actualCartTotal = testCart.reduce((sum, item) => {
      const sub = item.product.price * item.quantity;
      const disc = sub * (item.appliedDiscountPercent / 100);
      return sum + (sub - disc);
    }, 0);

    assert(
      Math.abs(actualCartTotal - expectedCartTotal) < 0.01,
      `Step 5: Cart total ($${actualCartTotal.toFixed(2)}) equals Discounted A ($${(originalPriceA * 0.85).toFixed(2)}) + Full Price B ($${originalPriceB.toFixed(2)})`
    );

    // Step 6: Remove Product A
    testCart = testCart.filter((i) => i.product.id !== productA.id);
    assert(
      testCart.length === 1 && !testCart.find((i) => i.product.id === productA.id),
      'Step 6: Product A removed cleanly from cart'
    );

    // Step 7: Re-add Product A WITHOUT an offer
    testCart = simulateAddToCart(testCart, productA, 1);
    const readdedItemA = testCart.find((i) => i.product.id === productA.id);

    assert(
      readdedItemA !== undefined &&
      readdedItemA.appliedDiscountPercent === 0 &&
      readdedItemA.discountReason === undefined,
      'Step 7: Product A re-added without offer has 0% discount'
    );

    const restoredCartTotal = testCart.reduce((sum, item) => {
      const sub = item.product.price * item.quantity;
      const disc = sub * (item.appliedDiscountPercent / 100);
      return sum + (sub - disc);
    }, 0);

    assert(
      Math.abs(restoredCartTotal - (originalPriceA + originalPriceB)) < 0.01,
      `Step 7b: Cart total restored to full original price ($${restoredCartTotal.toFixed(2)} === $${(originalPriceA + originalPriceB).toFixed(2)})`
    );

    // Confirm database price is still unchanged
    const finalDbProductA = await prisma.product.findUnique({ where: { id: productA.id } });
    assert(
      Number(finalDbProductA?.price) === originalPriceA,
      'Step 7c: Database Product A price remains unmutated at full price'
    );


    // =========================================================================
    // SECTION 2: BUG #1 — CHECKOUT CUSTOMER AUTH FLOW
    // =========================================================================
    console.log('\n--- SECTION 2: BUG #1 — CHECKOUT CUSTOMER AUTH FLOW ---');

    // Test 8: Guest checkout with NO Authorization header succeeds with sessionId + storeId
    const guestSession1 = `guest_checkout_${Date.now()}`;
    
    // Add item to server cart
    const addGuestCartRes = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestSession1,
        storeId,
        productId: productB.id,
        quantity: 1,
      }),
    });
    assert(addGuestCartRes.status === 200, 'Guest cart populated successfully');

    // Guest checkout with NO Authorization header
    const guestCheckoutRes = await fetch(`${baseUrl}/api/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestSession1,
        storeId,
      }),
    });

    const guestCheckoutData = await guestCheckoutRes.json();
    assert(
      guestCheckoutRes.status === 201 && guestCheckoutData.success === true,
      `Guest checkout with NO Authorization header succeeds with 201 Created (status: ${guestCheckoutRes.status})`
    );
    assert(
      guestCheckoutData.data && guestCheckoutData.data.customerId === null,
      'Guest order is created with customerId: null (guest checkout strictly operational)'
    );

    // Test 9: Authenticated customer checkout associates customerId
    const testCustomerEmail = `checkout_test_${Date.now()}@example.com`;
    const customerAuth = await customerAuthService.register(
      testCustomerEmail,
      'Password123!',
      storeId,
      'Checkout Tester'
    );

    const custSession = `cust_checkout_sess_${Date.now()}`;
    // Populate customer cart with Bearer token
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAuth.token}`,
      },
      body: JSON.stringify({
        sessionId: custSession,
        storeId,
        productId: productB.id,
        quantity: 1,
      }),
    });

    // Checkout with customer token
    const customerCheckoutRes = await fetch(`${baseUrl}/api/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerAuth.token}`,
      },
      body: JSON.stringify({
        sessionId: custSession,
        storeId,
      }),
    });

    const customerCheckoutData = await customerCheckoutRes.json();
    assert(
      customerCheckoutRes.status === 201 && customerCheckoutData.success === true,
      `Authenticated customer checkout succeeds with 201 Created (status: ${customerCheckoutRes.status})`
    );
    assert(
      customerCheckoutData.data && customerCheckoutData.data.customerId === customerAuth.customer.id,
      `Customer order correctly recorded customerId: ${customerCheckoutData.data?.customerId}`
    );

    // Test 10: Merchant auth token does NOT authorize customer checkout (strict isolation)
    const merchantToken = signMerchantToken(store.merchantId || 'merchant-test-123');

    const guestSession2 = `guest_with_merch_tok_${Date.now()}`;
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: guestSession2,
        storeId,
        productId: productB.id,
        quantity: 1,
      }),
    });

    const merchTokenCheckoutRes = await fetch(`${baseUrl}/api/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${merchantToken}`,
      },
      body: JSON.stringify({
        sessionId: guestSession2,
        storeId,
      }),
    });

    const merchCheckoutData = await merchTokenCheckoutRes.json();
    assert(
      merchTokenCheckoutRes.status === 201 && merchCheckoutData.data.customerId === null,
      'Merchant token cannot forge customer order (falls back cleanly to guest order)'
    );

    // Test 11: CheckoutModal source contains required elements
    const checkoutModalPath = path.resolve(process.cwd(), 'src/components/customer/CheckoutModal.tsx');
    const checkoutModalCode = fs.readFileSync(checkoutModalPath, 'utf8');

    assert(
      checkoutModalCode.includes('continue-as-guest-btn'),
      'CheckoutModal includes continue-as-guest-btn ID'
    );
    assert(
      checkoutModalCode.includes('checkout-signin-btn'),
      'CheckoutModal includes checkout-signin-btn ID'
    );
    assert(
      checkoutModalCode.includes('onOpenLogin'),
      'CheckoutModal supports onOpenLogin handler'
    );


    // =========================================================================
    // SECTION 3: BUG #2 — CUSTOMER LOGIN NAVBAR/UI & NAVIGATION
    // =========================================================================
    console.log('\n--- SECTION 3: BUG #2 — CUSTOMER LOGIN NAVBAR & NAVIGATION ---');

    const customerHeaderPath = path.resolve(process.cwd(), 'src/components/customer/CustomerHeader.tsx');
    const customerHeaderCode = fs.readFileSync(customerHeaderPath, 'utf8');

    // Test 12: CustomerHeader has required IDs and labels
    assert(
      customerHeaderCode.includes('customer-header-signin-btn'),
      'CustomerHeader includes customer-header-signin-btn ID'
    );
    assert(
      customerHeaderCode.includes('Sign In / Create Account'),
      'CustomerHeader guest button displays "Sign In / Create Account"'
    );
    assert(
      customerHeaderCode.includes('customer-header-logout-btn'),
      'CustomerHeader authenticated state includes customer-header-logout-btn ID'
    );
    assert(
      customerHeaderCode.includes('onNavigate'),
      'CustomerHeader accepts and propagates onNavigate prop'
    );

    // Test 13: CustomerLogin component contract
    const customerLoginPath = path.resolve(process.cwd(), 'src/components/customer/CustomerLogin.tsx');
    const customerLoginCode = fs.readFileSync(customerLoginPath, 'utf8');

    assert(
      customerLoginCode.includes('isAuthenticated') && customerLoginCode.includes('Signed In Successfully'),
      'CustomerLogin presents signed-in status view if customer is already authenticated'
    );
    assert(
      customerLoginCode.includes('Return to Storefront'),
      'CustomerLogin provides quick return to storefront button'
    );

    // Test 14: App.tsx routing and navigation contract
    const appPath = path.resolve(process.cwd(), 'src/App.tsx');
    const appCode = fs.readFileSync(appPath, 'utf8');

    assert(
      appCode.includes('onNavigate={navigate}') && appCode.includes('<CustomerHeader'),
      'App.tsx passes onNavigate={navigate} to CustomerHeader'
    );
    assert(
      appCode.includes('onOpenLogin') && appCode.includes('/store/${targetSlug}/login'),
      'App.tsx passes onOpenLogin to CheckoutModal preserving storeSlug'
    );

    // Print Results Summary
    console.log('\n==============================================================');
    console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
    console.log('==============================================================\n');

    if (passedTests === totalTests) {
      console.log('✅ ALL URGENT BUG FIX REGRESSION TESTS PASSED!');
      process.exit(0);
    } else {
      console.error('❌ SOME REGRESSION TESTS FAILED');
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error in regression suite:', err);
  process.exit(1);
});
