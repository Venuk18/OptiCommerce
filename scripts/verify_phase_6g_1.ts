import { prisma } from '../server/db/prisma';
import { merchantDashboardService } from '../server/services/merchant-dashboard.service';
import { merchantDashboardController } from '../server/controllers/merchant-dashboard.controller';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runTests() {
  const results: TestResult[] = [];

  console.log('\n======================================================');
  console.log('PHASE 6G.1 — MERCHANT FUNNEL ANALYTICS BACKEND VERIFICATION');
  console.log('======================================================\n');

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

  // 1. Setup isolated stores for testing
  const [merchantA, merchantB, merchantEmpty] = await Promise.all([
    prisma.merchant.create({
      data: {
        name: `Merchant 6G1 Alpha ${timestamp}`,
        email: `merchant-6g1-a-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6G1 Alpha ${timestamp}`,
            slug: `store-6g1-alpha-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    }),
    prisma.merchant.create({
      data: {
        name: `Merchant 6G1 Beta ${timestamp}`,
        email: `merchant-6g1-b-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6G1 Beta ${timestamp}`,
            slug: `store-6g1-beta-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    }),
    prisma.merchant.create({
      data: {
        name: `Merchant 6G1 Empty ${timestamp}`,
        email: `merchant-6g1-empty-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6G1 Empty ${timestamp}`,
            slug: `store-6g1-empty-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    }),
  ]);

  const storeA = merchantA.store!;
  const storeB = merchantB.store!;
  const storeEmpty = merchantEmpty.store!;

  // Create products
  const [productA, productB] = await Promise.all([
    prisma.product.create({
      data: {
        storeId: storeA.id,
        name: `Gadget Alpha ${timestamp}`,
        category: 'Electronics',
        price: 3000,
        costPrice: 1800,
        stock: 50,
        status: 'PUBLISHED',
      },
    }),
    prisma.product.create({
      data: {
        storeId: storeB.id,
        name: `Widget Beta ${timestamp}`,
        category: 'Accessories',
        price: 1500,
        costPrice: 900,
        stock: 50,
        status: 'PUBLISHED',
      },
    }),
  ]);

  const expectedKeys = [
    'recommendationViews',
    'recommendationClicks',
    'recommendationClickRate',
    'productViews',
    'addToCartEvents',
    'addToCartRate',
    'checkoutStarted',
    'purchases',
    'checkoutConversionRate',
    'offerViews',
    'offerAccepted',
    'offerAcceptanceRate',
  ];

  // Test 1: Valid clean store returns 200/valid object
  await test(1, 'Valid store returns funnel data object', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeEmpty.id);
    if (!funnel || typeof funnel !== 'object') {
      throw new Error('Funnel response must be an object');
    }
  });

  // Test 2: Missing storeId rejected with 400
  await test(2, 'Missing storeId rejected with 400 AppError', async () => {
    let errorCaught = false;
    try {
      await merchantDashboardService.getFunnel('');
    } catch (err: any) {
      errorCaught = true;
      if (err.statusCode !== 400) {
        throw new Error(`Expected 400 statusCode, got: ${err.statusCode}`);
      }
    }
    if (!errorCaught) throw new Error('Expected missing storeId to throw an error');
  });

  // Test 3: Non-existent storeId rejected with 404
  await test(3, 'Non-existent storeId rejected with 404 AppError', async () => {
    let errorCaught = false;
    try {
      await merchantDashboardService.getFunnel('non-existent-store-uuid-404');
    } catch (err: any) {
      errorCaught = true;
      if (err.statusCode !== 404) {
        throw new Error(`Expected 404 statusCode, got: ${err.statusCode}`);
      }
    }
    if (!errorCaught) throw new Error('Expected unknown storeId to throw an error');
  });

  // Test 4: Returns all 12 required metric keys with numbers
  await test(4, 'Returns all 12 required metric keys with number types', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeEmpty.id);
    for (const key of expectedKeys) {
      if (!(key in funnel)) {
        throw new Error(`Missing expected metric key: ${key}`);
      }
      if (typeof (funnel as any)[key] !== 'number') {
        throw new Error(`Metric ${key} must be a number, received: ${typeof (funnel as any)[key]}`);
      }
    }
  });

  // Test 5: Empty store returns zeroed metrics
  await test(5, 'Empty store returns zeroed metrics (all 12 metrics = 0)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeEmpty.id);
    for (const key of expectedKeys) {
      if ((funnel as any)[key] !== 0) {
        throw new Error(`Expected ${key} to be 0 for empty store, got ${(funnel as any)[key]}`);
      }
    }
  });

  // Bulk Seed events for Store A
  // 10 rec views, 4 clicks, 20 product views, 7 add-to-carts, 6 checkouts started, 3 purchases, 8 offer views, 2 offer accepted
  const storeAEvents: any[] = [];
  for (let i = 0; i < 10; i++) {
    storeAEvents.push({
      sessionId: `sess-rec-${i}`,
      storeId: storeA.id,
      eventType: 'RECOMMENDATION_VIEW',
    });
  }
  for (let i = 0; i < 4; i++) {
    storeAEvents.push({
      sessionId: `sess-rec-${i}`,
      storeId: storeA.id,
      eventType: 'RECOMMENDATION_CLICK',
    });
  }
  for (let i = 0; i < 20; i++) {
    storeAEvents.push({
      sessionId: `sess-pv-${i}`,
      storeId: storeA.id,
      productId: productA.id,
      eventType: 'PRODUCT_VIEW',
    });
  }
  for (let i = 0; i < 7; i++) {
    storeAEvents.push({
      sessionId: `sess-pv-${i}`,
      storeId: storeA.id,
      productId: productA.id,
      eventType: 'ADD_TO_CART',
    });
  }
  for (let i = 0; i < 6; i++) {
    storeAEvents.push({
      sessionId: `sess-co-${i}`,
      storeId: storeA.id,
      eventType: 'CHECKOUT_STARTED',
    });
  }
  for (let i = 0; i < 3; i++) {
    storeAEvents.push({
      sessionId: `sess-co-${i}`,
      storeId: storeA.id,
      eventType: 'PURCHASE',
      metadata: {
        source: 'payment_verification',
        total: 3000,
        currency: 'INR',
      },
    });
  }
  for (let i = 0; i < 8; i++) {
    storeAEvents.push({
      sessionId: `sess-off-${i}`,
      storeId: storeA.id,
      eventType: 'OFFER_VIEW',
    });
  }
  for (let i = 0; i < 2; i++) {
    storeAEvents.push({
      sessionId: `sess-off-${i}`,
      storeId: storeA.id,
      eventType: 'OFFER_ACCEPTED',
    });
  }

  await prisma.commerceEvent.createMany({ data: storeAEvents });

  // Test 6: recommendationViews counts accurately
  await test(6, 'recommendationViews counts correctly (10 views)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.recommendationViews !== 10) {
      throw new Error(`Expected recommendationViews=10, got ${funnel.recommendationViews}`);
    }
  });

  // Test 7: recommendationClicks counts accurately
  await test(7, 'recommendationClicks counts correctly (4 clicks)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.recommendationClicks !== 4) {
      throw new Error(`Expected recommendationClicks=4, got ${funnel.recommendationClicks}`);
    }
  });

  // Test 8: recommendationClickRate computes accurately (40.00%)
  await test(8, 'recommendationClickRate computes accurately (40.00%)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.recommendationClickRate !== 40) {
      throw new Error(`Expected recommendationClickRate=40, got ${funnel.recommendationClickRate}`);
    }
  });

  // Test 9: recommendationClickRate handles zero division safely
  await test(9, 'recommendationClickRate returns 0 when views = 0', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeEmpty.id);
    if (funnel.recommendationClickRate !== 0) {
      throw new Error(`Expected 0, got ${funnel.recommendationClickRate}`);
    }
  });

  // Test 10: productViews counts correctly
  await test(10, 'productViews counts correctly (20 views)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.productViews !== 20) {
      throw new Error(`Expected productViews=20, got ${funnel.productViews}`);
    }
  });

  // Test 11: addToCartEvents counts correctly
  await test(11, 'addToCartEvents counts correctly (7 events)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.addToCartEvents !== 7) {
      throw new Error(`Expected addToCartEvents=7, got ${funnel.addToCartEvents}`);
    }
  });

  // Test 12: addToCartRate computes accurately (35.00%)
  await test(12, 'addToCartRate computes accurately (35.00%)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.addToCartRate !== 35) {
      throw new Error(`Expected addToCartRate=35, got ${funnel.addToCartRate}`);
    }
  });

  // Test 13: addToCartRate handles zero division safely
  await test(13, 'addToCartRate returns 0 when productViews = 0', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeEmpty.id);
    if (funnel.addToCartRate !== 0) {
      throw new Error(`Expected 0, got ${funnel.addToCartRate}`);
    }
  });

  // Test 14: checkoutStarted counts correctly
  await test(14, 'checkoutStarted counts correctly (6 events)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.checkoutStarted !== 6) {
      throw new Error(`Expected checkoutStarted=6, got ${funnel.checkoutStarted}`);
    }
  });

  // Test 15: purchases counts verified purchases accurately
  await test(15, 'purchases counts verified purchases accurately (3 purchases)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.purchases !== 3) {
      throw new Error(`Expected purchases=3, got ${funnel.purchases}`);
    }
  });

  // Test 16: checkoutConversionRate computes accurately (50.00%)
  await test(16, 'checkoutConversionRate computes accurately (50.00%)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.checkoutConversionRate !== 50) {
      throw new Error(`Expected checkoutConversionRate=50, got ${funnel.checkoutConversionRate}`);
    }
  });

  // Test 17: checkoutConversionRate handles zero division safely
  await test(17, 'checkoutConversionRate returns 0 when checkoutStarted = 0', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeEmpty.id);
    if (funnel.checkoutConversionRate !== 0) {
      throw new Error(`Expected 0, got ${funnel.checkoutConversionRate}`);
    }
  });

  // Test 18: offerViews and offerAccepted count correctly
  await test(18, 'offerViews (8) and offerAccepted (2) count accurately', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.offerViews !== 8) {
      throw new Error(`Expected offerViews=8, got ${funnel.offerViews}`);
    }
    if (funnel.offerAccepted !== 2) {
      throw new Error(`Expected offerAccepted=2, got ${funnel.offerAccepted}`);
    }
  });

  // Test 19: offerAcceptanceRate computes accurately (25.00%)
  await test(19, 'offerAcceptanceRate computes accurately (25.00%)', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    if (funnel.offerAcceptanceRate !== 25) {
      throw new Error(`Expected offerAcceptanceRate=25, got ${funnel.offerAcceptanceRate}`);
    }
  });

  // Test 20: offerAcceptanceRate handles zero division safely
  await test(20, 'offerAcceptanceRate returns 0 when offerViews = 0', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeEmpty.id);
    if (funnel.offerAcceptanceRate !== 0) {
      throw new Error(`Expected 0, got ${funnel.offerAcceptanceRate}`);
    }
  });

  // Test 21: Store isolation - Store A events do not leak into Store B
  await test(21, 'Strict Store Isolation: Store A events never leak to Store B', async () => {
    // Add distinct events for Store B: 3 rec views, 1 click, 5 product views, 1 add to cart
    await prisma.commerceEvent.createMany({
      data: [
        { sessionId: 'b1', storeId: storeB.id, eventType: 'RECOMMENDATION_VIEW' },
        { sessionId: 'b2', storeId: storeB.id, eventType: 'RECOMMENDATION_VIEW' },
        { sessionId: 'b3', storeId: storeB.id, eventType: 'RECOMMENDATION_VIEW' },
        { sessionId: 'b1', storeId: storeB.id, eventType: 'RECOMMENDATION_CLICK' },
        { sessionId: 'b1', storeId: storeB.id, productId: productB.id, eventType: 'PRODUCT_VIEW' },
        { sessionId: 'b2', storeId: storeB.id, productId: productB.id, eventType: 'PRODUCT_VIEW' },
        { sessionId: 'b3', storeId: storeB.id, productId: productB.id, eventType: 'PRODUCT_VIEW' },
        { sessionId: 'b4', storeId: storeB.id, productId: productB.id, eventType: 'PRODUCT_VIEW' },
        { sessionId: 'b5', storeId: storeB.id, productId: productB.id, eventType: 'PRODUCT_VIEW' },
        { sessionId: 'b1', storeId: storeB.id, productId: productB.id, eventType: 'ADD_TO_CART' },
      ],
    });

    const funnelB = await merchantDashboardService.getFunnel(storeB.id);
    if (funnelB.recommendationViews !== 3) {
      throw new Error(`Expected storeB recViews=3, got ${funnelB.recommendationViews}`);
    }
    if (funnelB.recommendationClicks !== 1) {
      throw new Error(`Expected storeB recClicks=1, got ${funnelB.recommendationClicks}`);
    }
    if (funnelB.recommendationClickRate !== 33.33) {
      throw new Error(`Expected storeB recClickRate=33.33, got ${funnelB.recommendationClickRate}`);
    }
    if (funnelB.productViews !== 5) {
      throw new Error(`Expected storeB productViews=5, got ${funnelB.productViews}`);
    }
    if (funnelB.addToCartEvents !== 1) {
      throw new Error(`Expected storeB addToCartEvents=1, got ${funnelB.addToCartEvents}`);
    }
    if (funnelB.addToCartRate !== 20) {
      throw new Error(`Expected storeB addToCartRate=20, got ${funnelB.addToCartRate}`);
    }
    if (funnelB.checkoutStarted !== 0 || funnelB.purchases !== 0) {
      throw new Error(`Store B should have 0 checkout/purchases`);
    }

    // Verify Store A is unaffected by Store B additions
    const funnelA = await merchantDashboardService.getFunnel(storeA.id);
    if (funnelA.recommendationViews !== 10 || funnelA.productViews !== 20 || funnelA.purchases !== 3) {
      throw new Error(`Store A metrics mutated by Store B operations`);
    }
  });

  // Test 22: Read-only guarantees: calling funnel produces zero database mutations
  await test(22, 'Read-only guarantee: getFunnel produces zero DB mutations', async () => {
    const [eventsBefore, ordersBefore, productsBefore, storesBefore] = await Promise.all([
      prisma.commerceEvent.count(),
      prisma.order.count(),
      prisma.product.count(),
      prisma.store.count(),
    ]);

    await merchantDashboardService.getFunnel(storeA.id);
    await merchantDashboardService.getFunnel(storeB.id);
    await merchantDashboardService.getFunnel(storeEmpty.id);

    const [eventsAfter, ordersAfter, productsAfter, storesAfter] = await Promise.all([
      prisma.commerceEvent.count(),
      prisma.order.count(),
      prisma.product.count(),
      prisma.store.count(),
    ]);

    if (
      eventsBefore !== eventsAfter ||
      ordersBefore !== ordersAfter ||
      productsBefore !== productsAfter ||
      storesBefore !== storesAfter
    ) {
      throw new Error(
        `Database mutation detected during read-only funnel call: ` +
        `events (${eventsBefore}->${eventsAfter}), orders (${ordersBefore}->${ordersAfter}), ` +
        `products (${productsBefore}->${productsAfter}), stores (${storesBefore}->${storesAfter})`
      );
    }
  });

  // Test 23: Controller Integration test
  await test(23, 'Controller Integration: handles req/res and sends HTTP 200 payload', async () => {
    let statusCode = 0;
    let jsonPayload: any = null;

    const req: any = {
      query: { storeId: storeA.id },
      merchant: { id: merchantA.id },
    };
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonPayload = data;
        return res;
      },
    };
    const next: any = (err: any) => {
      if (err) throw err;
    };

    await merchantDashboardController.getFunnel(req, res, next);

    if (statusCode !== 200) {
      throw new Error(`Expected HTTP 200, got ${statusCode}`);
    }
    if (!jsonPayload || !jsonPayload.success || !jsonPayload.data) {
      throw new Error(`Expected { success: true, data: {...} } response format`);
    }
    if (jsonPayload.data.recommendationViews !== 10 || jsonPayload.data.purchases !== 3) {
      throw new Error(`Controller returned invalid payload data`);
    }
  });

  // Test 24: Privacy & Security: output contains no sensitive merchant economics or PII
  await test(24, 'Privacy & Security: No PII, passwords, costs, or API keys exposed', async () => {
    const funnel = await merchantDashboardService.getFunnel(storeA.id);
    const jsonStr = JSON.stringify(funnel).toLowerCase();

    const forbiddenTerms = [
      'costprice',
      'cost_price',
      'password',
      'email',
      'secret',
      'token',
      'apikey',
      'margin',
      'profit',
      'customer',
      'address',
    ];

    for (const term of forbiddenTerms) {
      if (jsonStr.includes(term)) {
        throw new Error(`Forbidden sensitive term "${term}" found in funnel analytics payload`);
      }
    }
  });

  // Final Results
  console.log('\n======================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`VERIFICATION SUMMARY: ${passed}/${results.length} tests passed (${failed} failed)`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error(`FAILED TESTS: ${results.filter((r) => !r.passed).map((f) => f.num).join(', ')}`);
    await prisma.$disconnect();
    process.exit(1);
  } else {
    console.log('ALL PHASE 6G.1 TESTS PASSED SUCCESSFULLY!');
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('Test execution error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
