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

  console.log('\n==================================================');
  console.log('PHASE 6E — MERCHANT REVENUE DASHBOARD VERIFICATION');
  console.log('==================================================\n');

  // Helper to run a test step
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

  // Setup: Create 3 clean isolated test merchants and stores
  const timestamp = Date.now();

  const [merchantA, merchantB, merchantEmpty] = await Promise.all([
    prisma.merchant.create({
      data: {
        name: `Merchant 6E Alpha ${timestamp}`,
        email: `merchant-6e-a-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6E Alpha ${timestamp}`,
            slug: `store-6e-alpha-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    }),
    prisma.merchant.create({
      data: {
        name: `Merchant 6E Beta ${timestamp}`,
        email: `merchant-6e-b-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6E Beta ${timestamp}`,
            slug: `store-6e-beta-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    }),
    prisma.merchant.create({
      data: {
        name: `Merchant 6E Empty ${timestamp}`,
        email: `merchant-6e-empty-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6E Empty ${timestamp}`,
            slug: `store-6e-empty-${timestamp}`,
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

  // Create products for Store A and Store B
  const [productA, productB] = await Promise.all([
    prisma.product.create({
      data: {
        storeId: storeA.id,
        name: `Alpha Gadget ${timestamp}`,
        category: 'Electronics',
        price: 2500,
        costPrice: 1500,
        stock: 100,
        status: 'PUBLISHED',
      },
    }),
    prisma.product.create({
      data: {
        storeId: storeB.id,
        name: `Beta Gizmo ${timestamp}`,
        category: 'Electronics',
        price: 4000,
        costPrice: 2000,
        stock: 100,
        status: 'PUBLISHED',
      },
    }),
  ]);

  // Test 1: Valid clean store returns summary with all required keys and zero initial state
  await test(1, 'Valid clean store returns summary structure', async () => {
    const summary = await merchantDashboardService.getSummary(storeA.id);
    if (!summary || typeof summary !== 'object') {
      throw new Error('Summary response must be an object');
    }
    const expectedKeys = [
      'totalRevenue',
      'totalOrders',
      'averageOrderValue',
      'offerAcceptanceRate',
      'recoveredSales',
      'bundleRevenue',
    ];
    for (const k of expectedKeys) {
      if (!(k in summary)) {
        throw new Error(`Missing expected metric key: ${k}`);
      }
      if (typeof (summary as any)[k] !== 'number') {
        throw new Error(`Metric ${k} must be a number, received: ${typeof (summary as any)[k]}`);
      }
    }
    if (summary.totalRevenue !== 0 || summary.totalOrders !== 0 || summary.averageOrderValue !== 0) {
      throw new Error(`Initial store should have 0 revenue and orders, got: ${JSON.stringify(summary)}`);
    }
  });

  // Test 2: Missing storeId rejected with 400
  await test(2, 'Missing storeId rejected with 400 AppError', async () => {
    let errorCaught = false;
    try {
      await merchantDashboardService.getSummary('' as any);
    } catch (err: any) {
      errorCaught = true;
      if (err.statusCode !== 400) {
        throw new Error(`Expected 400 statusCode, got: ${err.statusCode}`);
      }
    }
    if (!errorCaught) throw new Error('Expected missing storeId to throw an error');
  });

  // Test 3: Unknown storeId rejected with 404
  await test(3, 'Unknown storeId rejected with 404 AppError', async () => {
    let errorCaught = false;
    try {
      await merchantDashboardService.getSummary('non-existent-store-uuid-9999');
    } catch (err: any) {
      errorCaught = true;
      if (err.statusCode !== 404) {
        throw new Error(`Expected 404 statusCode, got: ${err.statusCode}`);
      }
    }
    if (!errorCaught) throw new Error('Expected unknown storeId to throw 404');
  });

  // Test 4: Paid & Confirmed order is included in totalRevenue and totalOrders
  await test(4, 'Paid/confirmed order is included in totalRevenue and totalOrders', async () => {
    await prisma.order.create({
      data: {
        sessionId: `sess_${timestamp}_1`,
        storeId: storeA.id,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        subtotal: 5000,
        discount: 500,
        total: 4500,
        currency: 'INR',
        items: {
          create: [
            {
              productId: productA.id,
              productName: productA.name,
              quantity: 2,
              unitPrice: 2500,
              discountPercent: 10,
              discountAmount: 500,
              lineTotal: 4500,
            },
          ],
        },
      },
    });

    const summary = await merchantDashboardService.getSummary(storeA.id);
    if (summary.totalOrders !== 1) {
      throw new Error(`Expected totalOrders=1, got ${summary.totalOrders}`);
    }
    if (summary.totalRevenue !== 4500) {
      throw new Error(`Expected totalRevenue=4500, got ${summary.totalRevenue}`);
    }
  });

  // Test 5: Pending order is excluded from revenue
  await test(5, 'Pending order is excluded from revenue', async () => {
    await prisma.order.create({
      data: {
        sessionId: `sess_${timestamp}_pending`,
        storeId: storeA.id,
        status: 'PENDING',
        paymentStatus: 'CREATED',
        subtotal: 10000,
        discount: 0,
        total: 10000,
        currency: 'INR',
      },
    });

    const summary = await merchantDashboardService.getSummary(storeA.id);
    if (summary.totalOrders !== 1 || summary.totalRevenue !== 4500) {
      throw new Error(`Pending order improperly counted! totalOrders=${summary.totalOrders}, totalRevenue=${summary.totalRevenue}`);
    }
  });

  // Test 6: Cancelled order is excluded from revenue
  await test(6, 'Cancelled order is excluded from revenue', async () => {
    await prisma.order.create({
      data: {
        sessionId: `sess_${timestamp}_cancelled`,
        storeId: storeA.id,
        status: 'CANCELLED',
        paymentStatus: 'PAID', // even if payment status was paid, cancelled order must be excluded
        subtotal: 8000,
        discount: 0,
        total: 8000,
        currency: 'INR',
      },
    });

    const summary = await merchantDashboardService.getSummary(storeA.id);
    if (summary.totalOrders !== 1 || summary.totalRevenue !== 4500) {
      throw new Error(`Cancelled order improperly counted! totalOrders=${summary.totalOrders}, totalRevenue=${summary.totalRevenue}`);
    }
  });

  // Test 7: Failed payment order is excluded from revenue
  await test(7, 'Failed payment order is excluded from revenue', async () => {
    await prisma.order.create({
      data: {
        sessionId: `sess_${timestamp}_failed`,
        storeId: storeA.id,
        status: 'CONFIRMED',
        paymentStatus: 'FAILED',
        subtotal: 7500,
        discount: 0,
        total: 7500,
        currency: 'INR',
      },
    });

    const summary = await merchantDashboardService.getSummary(storeA.id);
    if (summary.totalOrders !== 1 || summary.totalRevenue !== 4500) {
      throw new Error(`Failed payment order improperly counted! totalOrders=${summary.totalOrders}, totalRevenue=${summary.totalRevenue}`);
    }
  });

  // Test 8: Store isolation - Store B order must not leak into Store A
  await test(8, 'Store isolation: Store B orders and revenue do not leak to Store A', async () => {
    await prisma.order.create({
      data: {
        sessionId: `sess_${timestamp}_storeb`,
        storeId: storeB.id,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        subtotal: 20000,
        discount: 0,
        total: 20000,
        currency: 'INR',
      },
    });

    const summaryA = await merchantDashboardService.getSummary(storeA.id);
    const summaryB = await merchantDashboardService.getSummary(storeB.id);

    if (summaryA.totalOrders !== 1 || summaryA.totalRevenue !== 4500) {
      throw new Error(`Store A summary polluted by Store B! totalOrders=${summaryA.totalOrders}, totalRevenue=${summaryA.totalRevenue}`);
    }
    if (summaryB.totalOrders !== 1 || summaryB.totalRevenue !== 20000) {
      throw new Error(`Store B summary incorrect! totalOrders=${summaryB.totalOrders}, totalRevenue=${summaryB.totalRevenue}`);
    }
  });

  // Test 9: Multiple paid orders derive accurate revenue sum and AOV
  await test(9, 'Multiple paid orders derive accurate revenue sum and AOV calculation', async () => {
    // Add 2nd paid order for Store A of 1500.50
    await prisma.order.create({
      data: {
        sessionId: `sess_${timestamp}_2`,
        storeId: storeA.id,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        subtotal: 1500.5,
        discount: 0,
        total: 1500.5,
        currency: 'INR',
      },
    });

    const summary = await merchantDashboardService.getSummary(storeA.id);
    // 4500 + 1500.50 = 6000.50
    // totalOrders = 2
    // AOV = 6000.50 / 2 = 3000.25
    if (summary.totalOrders !== 2) {
      throw new Error(`Expected totalOrders=2, got ${summary.totalOrders}`);
    }
    if (summary.totalRevenue !== 6000.5) {
      throw new Error(`Expected totalRevenue=6000.50, got ${summary.totalRevenue}`);
    }
    if (summary.averageOrderValue !== 3000.25) {
      throw new Error(`Expected averageOrderValue=3000.25, got ${summary.averageOrderValue}`);
    }
  });

  // Test 10: Zero-order AOV returns 0
  await test(10, 'Zero-order store returns AOV of 0', async () => {
    const emptySummary = await merchantDashboardService.getSummary(storeEmpty.id);
    if (emptySummary.totalOrders !== 0 || emptySummary.totalRevenue !== 0 || emptySummary.averageOrderValue !== 0) {
      throw new Error(`Expected 0 orders and 0 AOV, got ${JSON.stringify(emptySummary)}`);
    }
  });

  // Test 11: Offer acceptance rate calculation with views and accepted offers
  await test(11, 'Offer acceptance rate calculation (OFFER_ACCEPTED / OFFER_VIEW * 100)', async () => {
    // Log 4 OFFER_VIEW events for Store A
    await prisma.commerceEvent.createMany({
      data: [0, 1, 2, 3].map((i) => ({
        sessionId: `sess_offer_${timestamp}_${i}`,
        storeId: storeA.id,
        productId: productA.id,
        eventType: 'OFFER_VIEW',
      })),
    });

    // Log 1 OFFER_ACCEPTED event for Store A
    await prisma.commerceEvent.create({
      data: {
        sessionId: `sess_offer_${timestamp}_0`,
        storeId: storeA.id,
        productId: productA.id,
        eventType: 'OFFER_ACCEPTED',
        metadata: { discountPercent: 10 },
      },
    });

    // 1 / 4 * 100 = 25.00%
    const summary = await merchantDashboardService.getSummary(storeA.id);
    if (summary.offerAcceptanceRate !== 25) {
      throw new Error(`Expected offerAcceptanceRate=25, got ${summary.offerAcceptanceRate}`);
    }
  });

  // Test 12: Offer events isolation - Store B events do not affect Store A offer rate
  await test(12, 'Offer events isolation between stores', async () => {
    // Log 2 OFFER_VIEW and 2 OFFER_ACCEPTED for Store B (100% acceptance)
    await prisma.commerceEvent.createMany({
      data: [
        {
          sessionId: `sess_offer_b_${timestamp}_0`,
          storeId: storeB.id,
          productId: productB.id,
          eventType: 'OFFER_VIEW',
        },
        {
          sessionId: `sess_offer_b_${timestamp}_1`,
          storeId: storeB.id,
          productId: productB.id,
          eventType: 'OFFER_VIEW',
        },
        {
          sessionId: `sess_offer_b_${timestamp}_0`,
          storeId: storeB.id,
          productId: productB.id,
          eventType: 'OFFER_ACCEPTED',
        },
        {
          sessionId: `sess_offer_b_${timestamp}_1`,
          storeId: storeB.id,
          productId: productB.id,
          eventType: 'OFFER_ACCEPTED',
        },
      ],
    });

    const summaryA = await merchantDashboardService.getSummary(storeA.id);
    const summaryB = await merchantDashboardService.getSummary(storeB.id);

    if (summaryA.offerAcceptanceRate !== 25) {
      throw new Error(`Store A offer rate modified by Store B! Expected 25, got ${summaryA.offerAcceptanceRate}`);
    }
    if (summaryB.offerAcceptanceRate !== 100) {
      throw new Error(`Store B offer rate incorrect! Expected 100, got ${summaryB.offerAcceptanceRate}`);
    }
  });

  // Test 13: Zero offer views returns offerAcceptanceRate of 0
  await test(13, 'Zero offer views returns offerAcceptanceRate of 0 without NaN / divide-by-zero', async () => {
    const freshSummary = await merchantDashboardService.getSummary(storeEmpty.id);
    if (freshSummary.offerAcceptanceRate !== 0) {
      throw new Error(`Expected offerAcceptanceRate=0, got ${freshSummary.offerAcceptanceRate}`);
    }
  });

  // Test 14: Recovered sales does not fabricate numbers and aggregates attributable events
  await test(14, 'Recovered sales returns 0 when no attribution and aggregates explicit events', async () => {
    const initialSummary = await merchantDashboardService.getSummary(storeA.id);
    if (initialSummary.recoveredSales !== 0) {
      throw new Error(`Initial store must have recoveredSales=0, got ${initialSummary.recoveredSales}`);
    }

    // Add an explicit attributable PURCHASE event
    await prisma.commerceEvent.create({
      data: {
        sessionId: `sess_rec_${timestamp}`,
        storeId: storeA.id,
        productId: productA.id,
        eventType: 'PURCHASE',
        metadata: {
          source: 'sale_recovery',
          total: 1200.5,
        },
      },
    });

    const updatedSummary = await merchantDashboardService.getSummary(storeA.id);
    if (updatedSummary.recoveredSales !== 1200.5) {
      throw new Error(`Expected recoveredSales=1200.5, got ${updatedSummary.recoveredSales}`);
    }
  });

  // Test 15: Bundle revenue does not fabricate numbers and aggregates attributable events
  await test(15, 'Bundle revenue returns 0 when no attribution and aggregates explicit events', async () => {
    const initialSummary = await merchantDashboardService.getSummary(storeB.id);
    if (initialSummary.bundleRevenue !== 0) {
      throw new Error(`Initial store must have bundleRevenue=0, got ${initialSummary.bundleRevenue}`);
    }

    // Add an explicit attributable PURCHASE event for store B
    await prisma.commerceEvent.create({
      data: {
        sessionId: `sess_bundle_${timestamp}`,
        storeId: storeB.id,
        productId: productB.id,
        eventType: 'PURCHASE',
        metadata: {
          source: 'bundle',
          total: 799,
        },
      },
    });

    const updatedSummary = await merchantDashboardService.getSummary(storeB.id);
    if (updatedSummary.bundleRevenue !== 799) {
      throw new Error(`Expected bundleRevenue=799, got ${updatedSummary.bundleRevenue}`);
    }
  });

  // Test 16: Response payload contains zero costPrice, merchant margin, expectedProfit, or purchaseProbability
  await test(16, 'Zero leakage of costPrice, margins, expectedProfit, or purchaseProbability', async () => {
    const summary = await merchantDashboardService.getSummary(storeA.id);
    const jsonString = JSON.stringify(summary).toLowerCase();

    const forbiddenFields = [
      'costprice',
      'cost_price',
      'margin',
      'profit',
      'expectedprofit',
      'expected_profit',
      'purchaseprobability',
      'purchase_probability',
      'discount_economics',
    ];

    for (const field of forbiddenFields) {
      if (jsonString.includes(`"${field}"`)) {
        throw new Error(`Security breach: Found sensitive merchant economics field "${field}" in summary response!`);
      }
    }
  });

  // Test 17: Response payload contains zero customer PII or credentials
  await test(17, 'Zero customer PII or credentials in dashboard summary response', async () => {
    const summary = await merchantDashboardService.getSummary(storeA.id);
    const jsonString = JSON.stringify(summary).toLowerCase();

    const sensitiveFields = [
      'password',
      'email',
      'phone',
      'phonenumber',
      'apikey',
      'api_key',
      'token',
      'secret',
      'razorpay_key_secret',
      'webhook_secret',
    ];

    for (const field of sensitiveFields) {
      if (jsonString.includes(`"${field}"`)) {
        throw new Error(`Security breach: Found sensitive credential / PII field "${field}" in summary response!`);
      }
    }
  });

  // Test 18: Read-only analytics - DB entities are unmodified after calling summary
  await test(18, 'Analytics queries are strictly read-only and do not mutate database records', async () => {
    const ordersCountBefore = await prisma.order.count({ where: { storeId: storeA.id } });
    const eventsCountBefore = await prisma.commerceEvent.count({ where: { storeId: storeA.id } });
    const productsCountBefore = await prisma.product.count({ where: { storeId: storeA.id } });

    await merchantDashboardService.getSummary(storeA.id);

    const ordersCountAfter = await prisma.order.count({ where: { storeId: storeA.id } });
    const eventsCountAfter = await prisma.commerceEvent.count({ where: { storeId: storeA.id } });
    const productsCountAfter = await prisma.product.count({ where: { storeId: storeA.id } });

    if (
      ordersCountBefore !== ordersCountAfter ||
      eventsCountBefore !== eventsCountAfter ||
      productsCountBefore !== productsCountAfter
    ) {
      throw new Error('Database records count changed during read-only dashboard summary query!');
    }
  });

  // Test 19: Zero Gemini / AI model invocations
  await test(19, 'Zero Gemini / AI model invocations during dashboard analytics', async () => {
    // Verify that the merchantDashboardService code has zero AI/Gemini dependencies
    const serviceString = merchantDashboardService.constructor.toString();
    if (serviceString.includes('Gemini') || serviceString.includes('GoogleGenAI')) {
      throw new Error('Unexpected Gemini integration detected in merchantDashboardService');
    }
  });

  // Test 20: GET /api/merchant-dashboard/summary HTTP Endpoint verification
  await test(20, 'GET /api/merchant-dashboard/summary HTTP Express endpoint returns formatted JSON', async () => {
    // Test through Express app directly with mock req/res
    const req: any = {
      query: { storeId: storeA.id },
    };
    let responseStatus = 0;
    let responseBody: any = null;
    const res: any = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      json: (data: any) => {
        responseBody = data;
        return res;
      },
    };

    const next = (err: any) => {
      if (err) throw err;
    };

    await merchantDashboardController.getSummary(req, res, next);

    if (responseStatus !== 200) {
      throw new Error(`Expected HTTP 200, got ${responseStatus}`);
    }
    if (!responseBody || responseBody.success !== true || !responseBody.data) {
      throw new Error(`Invalid response structure: ${JSON.stringify(responseBody)}`);
    }
    if (responseBody.data.totalRevenue !== 6000.5) {
      throw new Error(`Expected totalRevenue=6000.5 in API response, got ${responseBody.data.totalRevenue}`);
    }
  });

  console.log('\n==================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`SUMMARY: ${passed}/${results.length} tests passed (${failed} failed)`);
  console.log('==================================================\n');

  if (failed > 0) {
    await prisma.$disconnect();
    process.exit(1);
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests()
  .catch(async (err) => {
    console.error('Test suite runner encountered fatal error:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
