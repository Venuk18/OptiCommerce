/**
 * OptiCommerce Regression Verification Script
 * Validates the fix for Store Identity Collision and Regression Symptoms:
 * 1. Seeded flagship merchant login works with Merchant@2026
 * 2. Stale store slug recovery (non-existent slug returns 404, triggers recovery)
 * 3. Flagship fallback store exists and serves valid published store & products
 * 4. Invalid merchant token handling (/api/auth/me returns 401 for bad token)
 * 5. Customer session isolation: guest cart survives and is bound to public store
 * 6. Cross-store authorization enforcement (Merchant A cannot access Store B dashboard/orders)
 * 7. Merchant login isolation: merchant tokens cannot query or mutate foreign stores
 * 8. Existing dashboard & orders regression tests remain intact
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('==================================================');
  console.log('STARTING STORE IDENTITY REGRESSION TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${testName}${detail ? ` - ${detail}` : ''}`);
      process.exitCode = 1;
    }
  }

  // ----------------------------------------------------
  // Test 1: Seeded Merchant Login
  // ----------------------------------------------------
  let merchantToken = '';
  let flagshipStoreId = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'merchant@opticommerce.io',
        password: 'Merchant@2026',
      }),
    });
    const json = await res.json();
    assert(
      res.status === 200 && json.success && !!json.data?.token && json.data?.merchant?.email === 'merchant@opticommerce.io',
      'Seeded merchant login succeeds with Merchant@2026',
      `Status: ${res.status}, response: ${JSON.stringify(json)}`
    );
    merchantToken = json.data?.token;
    flagshipStoreId = json.data?.merchant?.store?.id;
  } catch (err: any) {
    assert(false, 'Seeded merchant login succeeds with Merchant@2026', err.message);
  }

  // ----------------------------------------------------
  // Test 2: Verify /api/auth/me returns merchant and store
  // ----------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    const json = await res.json();
    assert(
      res.status === 200 && json.success && json.data?.store?.slug === 'opticommerce-flagship-electronics',
      'GET /api/auth/me resolves authenticated merchant and flagship store',
      `Status: ${res.status}`
    );
  } catch (err: any) {
    assert(false, 'GET /api/auth/me resolves authenticated merchant', err.message);
  }

  // ----------------------------------------------------
  // Test 3: Invalid merchant token returns 401
  // ----------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.or.expired.jwt.token' },
    });
    const json = await res.json();
    assert(
      res.status === 401 && !json.success,
      'Invalid merchant token returns 401 without crashing',
      `Status: ${res.status}`
    );
  } catch (err: any) {
    assert(false, 'Invalid merchant token returns 401', err.message);
  }

  // ----------------------------------------------------
  // Test 4: Customer Storefront - Flagship store lookup by slug
  // ----------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/stores/opticommerce-flagship-electronics`);
    const json = await res.json();
    assert(
      res.status === 200 && json.success && json.data?.slug === 'opticommerce-flagship-electronics' && json.data?.status === 'PUBLISHED',
      'Public customer store lookup for opticommerce-flagship-electronics returns 200 PUBLISHED',
      `Status: ${res.status}`
    );
  } catch (err: any) {
    assert(false, 'Customer storefront flagship lookup', err.message);
  }

  // ----------------------------------------------------
  // Test 5: Stale store slug returns 404 for non-existent store
  // ----------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/stores/nonexistent-stale-store-slug`);
    const json = await res.json();
    assert(
      res.status === 404 && !json.success,
      'Stale store slug request returns 404 (triggering client recovery to flagship)',
      `Status: ${res.status}`
    );
  } catch (err: any) {
    assert(false, 'Stale store slug returns 404', err.message);
  }

  // ----------------------------------------------------
  // Test 6: Flagship store products are published and available
  // ----------------------------------------------------
  let firstProductId = '';
  try {
    const res = await fetch(`${BASE_URL}/api/products?storeId=${flagshipStoreId}&status=PUBLISHED`);
    const json = await res.json();
    assert(
      res.status === 200 && json.success && Array.isArray(json.data) && json.data.length > 0,
      'Public products for flagship store are available and published',
      `Found ${json.data?.length || 0} products`
    );
    firstProductId = json.data?.[0]?.id;
  } catch (err: any) {
    assert(false, 'Public products for flagship store', err.message);
  }

  // ----------------------------------------------------
  // Test 7: Customer Session & Guest Cart works independently
  // ----------------------------------------------------
  const customerSessionId = 'cust-session-test-' + Date.now();
  try {
    // Add product to cart with customer session ID
    const addRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': customerSessionId,
      },
      body: JSON.stringify({
        storeId: flagshipStoreId,
        productId: firstProductId,
        quantity: 2,
      }),
    });
    const addJson = await addRes.json();
    assert(
      addRes.status === 200 && addJson.success && (addJson.data?.cart?.items?.length > 0 || addJson.data?.items?.length > 0),
      'Customer guest cart item addition succeeds with x-session-id',
      `Status: ${addRes.status}, data: ${JSON.stringify(addJson.data)}`
    );

    // Fetch cart with customer session ID
    const getRes = await fetch(`${BASE_URL}/api/cart?storeId=${flagshipStoreId}`, {
      headers: {
        'x-session-id': customerSessionId,
      },
    });
    const getJson = await getRes.json();
    const cartItems = getJson.data?.cart?.items || getJson.data?.items || [];
    assert(
      getRes.status === 200 && getJson.success && cartItems.length === 1,
      'Customer guest cart persists independently for the session',
      `Status: ${getRes.status}, items: ${cartItems.length}`
    );
  } catch (err: any) {
    assert(false, 'Customer session guest cart', err.message);
  }

  // ----------------------------------------------------
  // Test 8: Create a second merchant with their own private store
  // ----------------------------------------------------
  let merchantBToken = '';
  let storeBId = '';
  try {
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Merchant Beta',
        email: `merchant.beta.${Date.now()}@example.com`,
        password: 'Password@123',
        storeName: 'Merchant Beta Boutique',
      }),
    });
    const regJson = await regRes.json();
    assert(
      regRes.status === 201 && regJson.success && !!regJson.data?.token,
      'Register new Merchant B with private store succeeds',
      `Status: ${regRes.status}`
    );
    merchantBToken = regJson.data?.token;
    storeBId = regJson.data?.merchant?.store?.id;
  } catch (err: any) {
    assert(false, 'Register new Merchant B', err.message);
  }

  // ----------------------------------------------------
  // Test 9: Cross-store 403 enforcement (Merchant B cannot access Flagship store dashboard)
  // ----------------------------------------------------
  try {
    const summaryRes = await fetch(`${BASE_URL}/api/merchant-dashboard/summary?storeId=${flagshipStoreId}`, {
      headers: { Authorization: `Bearer ${merchantBToken}` },
    });
    const summaryJson = await summaryRes.json();
    assert(
      summaryRes.status === 403 && !summaryJson.success,
      'Cross-tenant isolation: Merchant B receives 403 attempting to access Flagship store dashboard',
      `Status: ${summaryRes.status}`
    );
  } catch (err: any) {
    assert(false, 'Cross-tenant isolation on dashboard summary', err.message);
  }

  // ----------------------------------------------------
  // Test 10: Cross-store 403 enforcement for orders
  // ----------------------------------------------------
  try {
    const ordersRes = await fetch(`${BASE_URL}/api/merchant-dashboard/orders?storeId=${flagshipStoreId}`, {
      headers: { Authorization: `Bearer ${merchantBToken}` },
    });
    const ordersJson = await ordersRes.json();
    assert(
      ordersRes.status === 403 && !ordersJson.success,
      'Cross-tenant isolation: Merchant B receives 403 attempting to query Flagship store orders',
      `Status: ${ordersRes.status}`
    );
  } catch (err: any) {
    assert(false, 'Cross-tenant isolation on merchant orders', err.message);
  }

  // ----------------------------------------------------
  // Test 11: Merchant B CAN access their own private store
  // ----------------------------------------------------
  try {
    const summaryRes = await fetch(`${BASE_URL}/api/merchant-dashboard/summary?storeId=${storeBId}`, {
      headers: { Authorization: `Bearer ${merchantBToken}` },
    });
    const summaryJson = await summaryRes.json();
    assert(
      summaryRes.status === 200 && summaryJson.success,
      'Merchant B successfully accesses their own store dashboard',
      `Status: ${summaryRes.status}`
    );
  } catch (err: any) {
    assert(false, 'Merchant B own store dashboard access', err.message);
  }

  // ----------------------------------------------------
  // Test 12: Customer storefront still serves Flagship store after all merchant operations
  // ----------------------------------------------------
  try {
    const storeRes = await fetch(`${BASE_URL}/api/stores/opticommerce-flagship-electronics`);
    const storeJson = await storeRes.json();
    assert(
      storeRes.status === 200 && storeJson.data?.slug === 'opticommerce-flagship-electronics',
      'Flagship storefront remains intact and uncorrupted after merchant actions',
      `Status: ${storeRes.status}`
    );
  } catch (err: any) {
    assert(false, 'Flagship storefront stability', err.message);
  }

  console.log('\n==================================================');
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('==================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
