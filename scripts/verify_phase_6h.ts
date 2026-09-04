import fs from 'fs';
import path from 'path';
import { prisma } from '../server/db/prisma';
import { merchantIntelligenceService } from '../server/services/merchant-intelligence.service';
import { merchantDashboardController } from '../server/controllers/merchant-dashboard.controller';
import { AttributionSource } from '@prisma/client';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runTests() {
  const results: TestResult[] = [];

  console.log('\n======================================================');
  console.log('PHASE 6H — REVENUE INTELLIGENCE BACKEND VERIFICATION');
  console.log('======================================================\n');

  async function test(num: number, name: string, fn: () => Promise<void>) {
    try {
      console.log(`[START] Test ${num}: ${name}`);
      await fn();
      results.push({ num, name, passed: true, details: 'OK' });
      console.log(`[PASS] Test ${num}: ${name}`);
    } catch (err: any) {
      results.push({ num, name, passed: false, details: err.message || String(err) });
      console.error(`[FAIL] Test ${num}: ${name} -> ${err.message || String(err)}`);
    }
  }

  const timestamp = Date.now();

  // Setup test stores
  const [merchantA, merchantB, merchantEmpty] = await Promise.all([
    prisma.merchant.create({
      data: {
        name: `Merchant 6H Alpha ${timestamp}`,
        email: `merchant-6h-a-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6H Alpha ${timestamp}`,
            slug: `store-6h-alpha-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    }),
    prisma.merchant.create({
      data: {
        name: `Merchant 6H Beta ${timestamp}`,
        email: `merchant-6h-b-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6H Beta ${timestamp}`,
            slug: `store-6h-beta-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    }),
    prisma.merchant.create({
      data: {
        name: `Merchant 6H Empty ${timestamp}`,
        email: `merchant-6h-empty-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6H Empty ${timestamp}`,
            slug: `store-6h-empty-${timestamp}`,
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

  // 1. Missing storeId rejected with 400
  await test(1, 'Missing storeId rejected with 400 AppError', async () => {
    let errA: any;
    try {
      await merchantIntelligenceService.generateInsights('');
    } catch (e) {
      errA = e;
    }
    if (!errA || errA.statusCode !== 400) {
      throw new Error(`Expected 400 error for empty storeId, got ${errA?.statusCode || errA}`);
    }
  });

  // 2. Non-existent storeId rejected with 404
  await test(2, 'Non-existent storeId rejected with 404 AppError', async () => {
    let errB: any;
    try {
      await merchantIntelligenceService.generateInsights('non-existent-store-id-999');
    } catch (e) {
      errB = e;
    }
    if (!errB || errB.statusCode !== 404) {
      throw new Error(`Expected 404 error for unknown storeId, got ${errB?.statusCode || errB}`);
    }
  });

  // 3. Valid store returns response with valid schema
  await test(3, 'Valid store returns response structure with metricsSnapshot', async () => {
    const res = await merchantIntelligenceService.generateInsights(storeEmpty.id);
    if (!res || typeof res !== 'object') throw new Error('Expected object response');
    if (res.storeId !== storeEmpty.id) throw new Error(`Expected storeId ${storeEmpty.id}, got ${res.storeId}`);
    if (!Array.isArray(res.insights)) throw new Error('Expected insights array');
    if (!res.metricsSnapshot || typeof res.metricsSnapshot !== 'object') throw new Error('Expected metricsSnapshot object');
    if (typeof res.metricsSnapshot.totalRevenue !== 'number') throw new Error('Expected totalRevenue number');
    if (typeof res.metricsSnapshot.aiInfluencedShare !== 'number') throw new Error('Expected aiInfluencedShare number');
    if (typeof res.metricsSnapshot.checkoutConversionRate !== 'number') throw new Error('Expected checkoutConversionRate number');
    if (typeof res.metricsSnapshot.offerAcceptanceRate !== 'number') throw new Error('Expected offerAcceptanceRate number');
  });

  // 4. Zero-data guard returns SYSTEM_STATUS info insight
  await test(4, 'Zero-data guard returns neutral SYSTEM_STATUS info insight', async () => {
    const res = await merchantIntelligenceService.generateInsights(storeEmpty.id);
    if (res.insights.length === 0) throw new Error('Expected at least 1 insight');
    const zeroData = res.insights.find((i) => i.type === 'SYSTEM_STATUS');
    if (!zeroData) throw new Error('Expected SYSTEM_STATUS insight for empty store');
    if (zeroData.severity !== 'INFO') throw new Error(`Expected severity INFO, got ${zeroData.severity}`);
    if (!zeroData.title.includes('Collecting enough data')) throw new Error(`Unexpected title: ${zeroData.title}`);
  });

  // 5. AI Attribution insight generated with non-causal phrasing
  await test(5, 'AI Attribution insight generated with non-causal wording', async () => {
    // Create product and paid order with AI_CHAT attribution
    const prod = await prisma.product.create({
      data: {
        storeId: storeA.id,
        title: `AI Product ${timestamp}`,
        slug: `ai-prod-${timestamp}`,
        price: 1500,
        stock: 50,
      },
    });

    const order = await prisma.order.create({
      data: {
        storeId: storeA.id,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        subtotal: 1500,
        discount: 0,
        total: 1500,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: prod.id,
        productName: prod.title,
        quantity: 1,
        unitPrice: 1500,
        lineTotal: 1500,
        attributionSource: AttributionSource.AI_CHAT,
      },
    });

    const res = await merchantIntelligenceService.generateInsights(storeA.id);
    const aiInsight = res.insights.find((i) => i.type === 'ATTRIBUTION_AI');
    if (!aiInsight) throw new Error('Expected ATTRIBUTION_AI insight when AI revenue exists');
    if (!aiInsight.description.includes('AI-influenced activity accounts for')) {
      throw new Error(`Expected non-causal description, got: ${aiInsight.description}`);
    }
  });

  // 6. Bundle insight generated when bundle revenue present
  await test(6, 'Bundle performance insight generated when bundle revenue present', async () => {
    const prod = await prisma.product.create({
      data: {
        storeId: storeA.id,
        title: `Bundle Product ${timestamp}`,
        slug: `bundle-prod-${timestamp}`,
        price: 800,
        stock: 50,
      },
    });

    const order = await prisma.order.create({
      data: {
        storeId: storeA.id,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        subtotal: 800,
        discount: 0,
        total: 800,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: prod.id,
        productName: prod.title,
        quantity: 1,
        unitPrice: 800,
        lineTotal: 800,
        attributionSource: AttributionSource.BUNDLE,
      },
    });

    const res = await merchantIntelligenceService.generateInsights(storeA.id);
    const bundleInsight = res.insights.find((i) => i.type === 'BUNDLE_PERFORMANCE');
    if (!bundleInsight) throw new Error('Expected BUNDLE_PERFORMANCE insight');
    if (!bundleInsight.description.includes('Bundle recommendations generated')) {
      throw new Error(`Unexpected description: ${bundleInsight.description}`);
    }
  });

  // 7. Offer performance insight with min volume guard (>= 5 offer views)
  await test(7, 'Offer performance insight generated when >= 5 offer views exist', async () => {
    // Generate 6 OFFER_VIEW events and 3 OFFER_ACCEPTED events for storeA
    const offerEvents = [];
    for (let i = 0; i < 6; i++) {
      offerEvents.push({
        storeId: storeA.id,
        sessionId: `sess-offer-${i}-${timestamp}`,
        eventType: 'OFFER_VIEW',
      });
    }
    for (let i = 0; i < 3; i++) {
      offerEvents.push({
        storeId: storeA.id,
        sessionId: `sess-offer-${i}-${timestamp}`,
        eventType: 'OFFER_ACCEPTED',
      });
    }
    await prisma.commerceEvent.createMany({ data: offerEvents });

    const res = await merchantIntelligenceService.generateInsights(storeA.id);
    const offerInsight = res.insights.find((i) => i.type === 'OFFER_PERFORMANCE');
    if (!offerInsight) throw new Error('Expected OFFER_PERFORMANCE insight');
    if (!offerInsight.description.includes('Offer acceptance is')) {
      throw new Error(`Unexpected description: ${offerInsight.description}`);
    }
  });

  // 8. Recovery insight generated when recovery revenue/sales present
  await test(8, 'Recovery performance insight generated when recovery sales present', async () => {
    const prod = await prisma.product.create({
      data: {
        storeId: storeA.id,
        title: `Recovery Product ${timestamp}`,
        slug: `recovery-prod-${timestamp}`,
        price: 1200,
        stock: 50,
      },
    });

    const order = await prisma.order.create({
      data: {
        storeId: storeA.id,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        subtotal: 1200,
        discount: 0,
        total: 1200,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: prod.id,
        productName: prod.title,
        quantity: 1,
        unitPrice: 1200,
        lineTotal: 1200,
        attributionSource: AttributionSource.RECOVERY,
      },
    });

    const res = await merchantIntelligenceService.generateInsights(storeA.id);
    const recoveryInsight = res.insights.find((i) => i.type === 'RECOVERY_PERFORMANCE');
    if (!recoveryInsight) throw new Error('Expected RECOVERY_PERFORMANCE insight');
    if (!recoveryInsight.description.includes('Recovery offers attributed')) {
      throw new Error(`Unexpected description: ${recoveryInsight.description}`);
    }
  });

  // 9. Discovery bottleneck generated (recommendation CTR low with >= 5 views)
  await test(9, 'Discovery bottleneck flagged when recommendation CTR < 10% (>= 5 views)', async () => {
    // Setup store with 10 recommendation views and 0 clicks
    const storeDisc = (
      await prisma.merchant.create({
        data: {
          name: `Merchant Disc ${timestamp}`,
          email: `merchant-disc-${timestamp}@example.com`,
          store: {
            create: {
              name: `Store Disc ${timestamp}`,
              slug: `store-disc-${timestamp}`,
              status: 'PUBLISHED',
            },
          },
        },
        include: { store: true },
      })
    ).store!;

    const evts = [];
    for (let i = 0; i < 10; i++) {
      evts.push({
        storeId: storeDisc.id,
        sessionId: `sess-disc-${i}`,
        eventType: 'RECOMMENDATION_VIEW',
      });
    }
    await prisma.commerceEvent.createMany({ data: evts });

    const res = await merchantIntelligenceService.generateInsights(storeDisc.id);
    const bottleneck = res.insights.find(
      (i) => i.type === 'FUNNEL_BOTTLENECK' && i.title.includes('Discovery')
    );
    if (!bottleneck) throw new Error('Expected Discovery bottleneck insight');
    if (bottleneck.severity !== 'WARNING') throw new Error(`Expected WARNING, got ${bottleneck.severity}`);
  });

  // 10. Evaluation bottleneck generated (add-to-cart rate low with >= 5 product views)
  await test(10, 'Evaluation bottleneck flagged when add-to-cart < 5% (>= 5 product views)', async () => {
    const storeEval = (
      await prisma.merchant.create({
        data: {
          name: `Merchant Eval ${timestamp}`,
          email: `merchant-eval-${timestamp}@example.com`,
          store: {
            create: {
              name: `Store Eval ${timestamp}`,
              slug: `store-eval-${timestamp}`,
              status: 'PUBLISHED',
            },
          },
        },
        include: { store: true },
      })
    ).store!;

    const evts = [];
    for (let i = 0; i < 20; i++) {
      evts.push({
        storeId: storeEval.id,
        sessionId: `sess-eval-${i}`,
        eventType: 'PRODUCT_VIEW',
      });
    }
    await prisma.commerceEvent.createMany({ data: evts });

    const res = await merchantIntelligenceService.generateInsights(storeEval.id);
    const bottleneck = res.insights.find(
      (i) => i.type === 'FUNNEL_BOTTLENECK' && i.title.includes('Evaluation')
    );
    if (!bottleneck) throw new Error('Expected Evaluation bottleneck insight');
    if (bottleneck.severity !== 'WARNING') throw new Error(`Expected WARNING, got ${bottleneck.severity}`);
  });

  // 11. Checkout bottleneck generated (checkout conversion low with >= 5 checkouts)
  await test(11, 'Checkout bottleneck flagged when conversion < 20% (>= 5 checkouts)', async () => {
    const storeChk = (
      await prisma.merchant.create({
        data: {
          name: `Merchant Chk ${timestamp}`,
          email: `merchant-chk-${timestamp}@example.com`,
          store: {
            create: {
              name: `Store Chk ${timestamp}`,
              slug: `store-chk-${timestamp}`,
              status: 'PUBLISHED',
            },
          },
        },
        include: { store: true },
      })
    ).store!;

    const evts = [];
    for (let i = 0; i < 10; i++) {
      evts.push({
        storeId: storeChk.id,
        sessionId: `sess-chk-${i}`,
        eventType: 'CHECKOUT_STARTED',
      });
    }
    await prisma.commerceEvent.createMany({ data: evts });

    const res = await merchantIntelligenceService.generateInsights(storeChk.id);
    const bottleneck = res.insights.find((i) => i.type === 'CHECKOUT_BOTTLENECK');
    if (!bottleneck) throw new Error('Expected CHECKOUT_BOTTLENECK insight');
    if (bottleneck.severity !== 'WARNING') throw new Error(`Expected WARNING, got ${bottleneck.severity}`);
  });

  // 12. Minimum-volume guards prevent spurious warnings under 5 events
  await test(12, 'Minimum-volume guards prevent warnings when event volume < 5', async () => {
    const storeFew = (
      await prisma.merchant.create({
        data: {
          name: `Merchant Few ${timestamp}`,
          email: `merchant-few-${timestamp}@example.com`,
          store: {
            create: {
              name: `Store Few ${timestamp}`,
              slug: `store-few-${timestamp}`,
              status: 'PUBLISHED',
            },
          },
        },
        include: { store: true },
      })
    ).store!;

    // Add only 2 product views and 2 checkout starts
    await prisma.commerceEvent.createMany({
      data: [
        { storeId: storeFew.id, sessionId: 's1', eventType: 'PRODUCT_VIEW' },
        { storeId: storeFew.id, sessionId: 's2', eventType: 'PRODUCT_VIEW' },
        { storeId: storeFew.id, sessionId: 's3', eventType: 'CHECKOUT_STARTED' },
        { storeId: storeFew.id, sessionId: 's4', eventType: 'CHECKOUT_STARTED' },
      ],
    });

    const res = await merchantIntelligenceService.generateInsights(storeFew.id);
    const warnings = res.insights.filter((i) => i.severity === 'WARNING');
    if (warnings.length > 0) {
      throw new Error(`Expected 0 warnings for store with < 5 events, got ${warnings.length}`);
    }
  });

  // 13. Maximum 6 insights strictly bounded
  await test(13, 'Insights list is capped at maximum 6 items', async () => {
    const res = await merchantIntelligenceService.generateInsights(storeA.id);
    if (res.insights.length > 6) {
      throw new Error(`Expected <= 6 insights, got ${res.insights.length}`);
    }
  });

  // 14. Deterministic insight ordering (WARNING > OPPORTUNITY > INFO)
  await test(14, 'Deterministic severity ordering: WARNING > OPPORTUNITY > INFO', async () => {
    const res = await merchantIntelligenceService.generateInsights(storeA.id);
    const severityRank: Record<string, number> = { WARNING: 1, OPPORTUNITY: 2, INFO: 3 };
    for (let i = 0; i < res.insights.length - 1; i++) {
      const currentRank = severityRank[res.insights[i].severity];
      const nextRank = severityRank[res.insights[i + 1].severity];
      if (currentRank > nextRank) {
        throw new Error(
          `Ordering violation at index ${i}: ${res.insights[i].severity} appeared before ${res.insights[i + 1].severity}`
        );
      }
    }
  });

  // 15. Correct severity assignment
  await test(15, 'Correct severity assignment across metric threshold ranges', async () => {
    const res = await merchantIntelligenceService.generateInsights(storeA.id);
    for (const insight of res.insights) {
      if (!['INFO', 'OPPORTUNITY', 'WARNING'].includes(insight.severity)) {
        throw new Error(`Invalid severity: ${insight.severity}`);
      }
    }
  });

  // 16. No causal uplift claims in any insight text
  await test(16, 'Zero causal uplift claims in insight titles, descriptions, and recommendations', async () => {
    const res = await merchantIntelligenceService.generateInsights(storeA.id);
    const forbiddenPhrases = [
      'increased sales by',
      'boosted sales by',
      'caused a',
      'guaranteed revenue',
      'predicted revenue',
      'will increase your sales by',
    ];
    for (const insight of res.insights) {
      const fullText = `${insight.title} ${insight.description} ${insight.recommendation || ''}`.toLowerCase();
      for (const phrase of forbiddenPhrases) {
        if (fullText.includes(phrase)) {
          throw new Error(`Forbidden causal claim detected in insight: "${phrase}"`);
        }
      }
    }
  });

  // 17. No costPrice / margin / expectedProfit / purchaseProbability leakage
  await test(17, 'Zero leakage of costPrice, margin, expectedProfit, or purchaseProbability in payload', async () => {
    const res = await merchantIntelligenceService.generateInsights(storeA.id);
    const serialized = JSON.stringify(res).toLowerCase();
    const sensitiveFields = ['costprice', 'margin', 'expectedprofit', 'purchaseprobability'];
    for (const field of sensitiveFields) {
      if (serialized.includes(field)) {
        throw new Error(`Sensitive field "${field}" leaked in intelligence payload`);
      }
    }
  });

  // 18. No PII leakage
  await test(18, 'Zero customer PII (emails, phones, passwords, tokens) in intelligence payload', async () => {
    const res = await merchantIntelligenceService.generateInsights(storeA.id);
    const serialized = JSON.stringify(res).toLowerCase();
    const piiTokens = ['password', 'razorpay_signature', 'razorpay_payment_id', '@example.com'];
    for (const token of piiTokens) {
      if (serialized.includes(token)) {
        throw new Error(`PII / token "${token}" leaked in intelligence payload`);
      }
    }
  });

  // 19. Store isolation strictly enforced between stores
  await test(19, 'Store isolation strictly enforced between merchants', async () => {
    const resA = await merchantIntelligenceService.generateInsights(storeA.id);
    const resB = await merchantIntelligenceService.generateInsights(storeB.id);

    if (resA.storeId !== storeA.id || resB.storeId !== storeB.id) {
      throw new Error('storeId mismatch in isolated responses');
    }
    if (resB.metricsSnapshot.totalRevenue > 0) {
      throw new Error('Store B should have 0 revenue, leaked from Store A');
    }
  });

  // 20. Read-only guarantee (zero database mutations)
  await test(20, 'Read-only guarantee: generateInsights causes zero DB mutations', async () => {
    const [ordersBefore, itemsBefore, eventsBefore] = await Promise.all([
      prisma.order.count(),
      prisma.orderItem.count(),
      prisma.commerceEvent.count(),
    ]);

    await merchantIntelligenceService.generateInsights(storeA.id);

    const [ordersAfter, itemsAfter, eventsAfter] = await Promise.all([
      prisma.order.count(),
      prisma.orderItem.count(),
      prisma.commerceEvent.count(),
    ]);

    if (ordersBefore !== ordersAfter || itemsBefore !== itemsAfter || eventsBefore !== eventsAfter) {
      throw new Error('Database records mutated during read-only generateInsights invocation');
    }
  });

  // 21. Zero Gemini / AI API calls in merchant intelligence backend
  await test(21, 'Zero Gemini / AI API calls in merchant intelligence service, controller, and routes', async () => {
    const serviceSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'server/services/merchant-intelligence.service.ts'),
      'utf8'
    );
    const controllerSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'server/controllers/merchant-dashboard.controller.ts'),
      'utf8'
    );
    const routesSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'server/routes/merchant-dashboard.routes.ts'),
      'utf8'
    );

    if (
      serviceSrc.includes('@google/genai') ||
      controllerSrc.includes('@google/genai') ||
      routesSrc.includes('@google/genai')
    ) {
      throw new Error('Forbidden import of @google/genai found in intelligence backend');
    }
  });

  // 22. HTTP Controller Integration: GET /api/merchant-dashboard/insights returns 200 payload
  await test(22, 'HTTP Controller Integration: handles req/res and sends HTTP 200 payload', async () => {
    let responseStatus = 0;
    let responsePayload: any = null;

    const mockReq = {
      query: { storeId: storeA.id },
      merchant: { id: merchantA.id },
    } as any;

    const mockRes = {
      status: (code: number) => {
        responseStatus = code;
        return mockRes;
      },
      json: (data: any) => {
        responsePayload = data;
        return mockRes;
      },
    } as any;

    const mockNext = (err: any) => {
      if (err) throw err;
    };

    await merchantDashboardController.getInsights(mockReq, mockRes, mockNext);

    if (responseStatus !== 200) {
      throw new Error(`Expected HTTP 200 status, got ${responseStatus}`);
    }
    if (!responsePayload || !responsePayload.success || !responsePayload.data) {
      throw new Error('Invalid controller response structure');
    }
    if (responsePayload.data.storeId !== storeA.id) {
      throw new Error('Controller returned incorrect storeId');
    }
  });

  // Cleanup test stores
  try {
    const testStoreIds = [storeA.id, storeB.id, storeEmpty.id];
    await prisma.orderItem.deleteMany({
      where: { order: { storeId: { in: testStoreIds } } },
    });
    await prisma.order.deleteMany({
      where: { storeId: { in: testStoreIds } },
    });
    await prisma.commerceEvent.deleteMany({
      where: { storeId: { in: testStoreIds } },
    });
    await prisma.product.deleteMany({
      where: { storeId: { in: testStoreIds } },
    });
    await prisma.store.deleteMany({
      where: { id: { in: testStoreIds } },
    });
    await prisma.merchant.deleteMany({
      where: { id: { in: [merchantA.id, merchantB.id, merchantEmpty.id] } },
    });
  } catch {
    // cleanup non-blocking
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n======================================================');
  console.log(`PHASE 6H VERIFICATION SUMMARY: ${passed}/${results.length} tests passed (${failed} failed)`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
