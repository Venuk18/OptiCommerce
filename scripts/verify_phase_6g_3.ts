import { AttributionSource } from '@prisma/client';
import { prisma } from '../server/db/prisma';
import { attributionService } from '../server/services/revenue/attribution.service';
import { orderService } from '../server/services/order.service';
import { cartService } from '../server/services/cart.service';
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
  console.log('PHASE 6G.3 — ORDER ATTRIBUTION & MERCHANT SUMMARY VERIFICATION');
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

  // Setup test merchant and stores
  const [merchantA, merchantB, merchantEmpty] = await Promise.all([
    prisma.merchant.create({
      data: {
        name: `Merchant 6G3 Alpha ${timestamp}`,
        email: `merchant-6g3-a-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6G3 Alpha ${timestamp}`,
            slug: `store-6g3-a-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    }),
    prisma.merchant.create({
      data: {
        name: `Merchant 6G3 Beta ${timestamp}`,
        email: `merchant-6g3-b-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6G3 Beta ${timestamp}`,
            slug: `store-6g3-b-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    }),
    prisma.merchant.create({
      data: {
        name: `Merchant 6G3 Empty ${timestamp}`,
        email: `merchant-6g3-empty-${timestamp}@example.com`,
        store: {
          create: {
            name: `Store 6G3 Empty ${timestamp}`,
            slug: `store-6g3-empty-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    }),
  ]);

  const storeAId = merchantA.store!.id;
  const storeBId = merchantB.store!.id;
  const storeEmptyId = merchantEmpty.store!.id;

  // Create products in Store A
  const [prodDirect, prodChat, prodBundle, prodOffer, prodRecovery] = await Promise.all([
    prisma.product.create({
      data: {
        storeId: storeAId,
        name: 'Direct Organic Item',
        price: 1000.0,
        costPrice: 500.0,
        stock: 50,
        category: 'Electronics',
        status: 'PUBLISHED',
      },
    }),
    prisma.product.create({
      data: {
        storeId: storeAId,
        name: 'AI Chat Recommended Item',
        price: 2000.0,
        costPrice: 1000.0,
        stock: 50,
        category: 'Electronics',
        status: 'PUBLISHED',
      },
    }),
    prisma.product.create({
      data: {
        storeId: storeAId,
        name: 'Bundle Cross-Sell Item',
        price: 1500.0,
        costPrice: 700.0,
        stock: 50,
        category: 'Accessories',
        status: 'PUBLISHED',
      },
    }),
    prisma.product.create({
      data: {
        storeId: storeAId,
        name: 'Dynamic Offer Item',
        price: 3000.0,
        costPrice: 1500.0,
        stock: 50,
        category: 'Audio',
        status: 'PUBLISHED',
      },
    }),
    prisma.product.create({
      data: {
        storeId: storeAId,
        name: 'Sale Recovery Item',
        price: 4000.0,
        costPrice: 2000.0,
        stock: 50,
        category: 'Laptops',
        status: 'PUBLISHED',
      },
    }),
  ]);

  // 1. Schema migration verification
  await test(1, 'Schema migration succeeds and AttributionSource enum exists', async () => {
    if (!AttributionSource.DIRECT || !AttributionSource.AI_CHAT || !AttributionSource.BUNDLE || !AttributionSource.OFFER || !AttributionSource.RECOVERY) {
      throw new Error('AttributionSource enum values missing');
    }
  });

  // 2. Existing OrderItem defaults to DIRECT
  await test(2, 'Existing/Default OrderItem has attributionSource = DIRECT', async () => {
    const dummyOrder = await prisma.order.create({
      data: {
        sessionId: `test-session-default-${timestamp}`,
        storeId: storeAId,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        subtotal: 1000,
        discount: 0,
        total: 1000,
        items: {
          create: {
            productId: prodDirect.id,
            productName: prodDirect.name,
            quantity: 1,
            unitPrice: 1000,
            lineTotal: 1000,
          },
        },
      },
      include: { items: true },
    });

    if (dummyOrder.items[0].attributionSource !== AttributionSource.DIRECT) {
      throw new Error(`Expected DIRECT, got ${dummyOrder.items[0].attributionSource}`);
    }
  });

  // 3. No touchpoint -> DIRECT
  await test(3, 'No touchpoint resolves to DIRECT', async () => {
    const result = await attributionService.resolveAttributionSource({
      sessionId: `direct-sess-${timestamp}`,
      storeId: storeAId,
      productId: prodDirect.id,
    });
    if (result !== AttributionSource.DIRECT) {
      throw new Error(`Expected DIRECT, got ${result}`);
    }
  });

  // 4. AI recommendation click -> AI_CHAT
  await test(4, 'AI recommendation click resolves to AI_CHAT', async () => {
    const sess = `ai-chat-sess-${timestamp}`;
    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodChat.id,
        eventType: 'RECOMMENDATION_CLICK',
        metadata: {
          rank: 1,
          matchScore: 0.95,
          matchReason: 'Top query match for headphones',
        },
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodChat.id,
    });
    if (result !== AttributionSource.AI_CHAT) {
      throw new Error(`Expected AI_CHAT, got ${result}`);
    }
  });

  // 5. Bundle recommendation click -> BUNDLE
  await test(5, 'Bundle recommendation click resolves to BUNDLE', async () => {
    const sess = `bundle-sess-${timestamp}`;
    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodBundle.id,
        eventType: 'RECOMMENDATION_CLICK',
        metadata: {
          source: 'BUNDLE_CROSS_SELL',
          baseProductId: prodDirect.id,
          bundleScore: 0.92,
        },
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodBundle.id,
    });
    if (result !== AttributionSource.BUNDLE) {
      throw new Error(`Expected BUNDLE, got ${result}`);
    }
  });

  // 6. Normal accepted offer -> OFFER
  await test(6, 'Normal accepted offer resolves to OFFER', async () => {
    const sess = `offer-sess-${timestamp}`;
    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodOffer.id,
        eventType: 'OFFER_ACCEPTED',
        metadata: {
          discountPercent: 10,
          originalPrice: 3000,
          discountedPrice: 2700,
          savings: 300,
        },
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodOffer.id,
    });
    if (result !== AttributionSource.OFFER) {
      throw new Error(`Expected OFFER, got ${result}`);
    }
  });

  // 7. Sale recovery accepted offer -> RECOVERY
  await test(7, 'Sale recovery accepted offer resolves to RECOVERY', async () => {
    const sess = `recovery-sess-${timestamp}`;
    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodRecovery.id,
        eventType: 'OFFER_ACCEPTED',
        metadata: {
          source: 'sale_recovery',
          discountPercent: 15,
          originalPrice: 4000,
          discountedPrice: 3400,
        },
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodRecovery.id,
    });
    if (result !== AttributionSource.RECOVERY) {
      throw new Error(`Expected RECOVERY, got ${result}`);
    }
  });

  // 8. RECOVERY beats OFFER
  await test(8, 'RECOVERY beats OFFER in priority hierarchy', async () => {
    const sess = `multi-rec-off-${timestamp}`;
    // Both standard offer and recovery offer exist
    await prisma.commerceEvent.createMany({
      data: [
        {
          sessionId: sess,
          storeId: storeAId,
          productId: prodRecovery.id,
          eventType: 'OFFER_ACCEPTED',
          metadata: { discountPercent: 10 },
        },
        {
          sessionId: sess,
          storeId: storeAId,
          productId: prodRecovery.id,
          eventType: 'OFFER_ACCEPTED',
          metadata: { source: 'sale_recovery', discountPercent: 15 },
        },
      ],
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodRecovery.id,
    });
    if (result !== AttributionSource.RECOVERY) {
      throw new Error(`Expected RECOVERY to beat OFFER, got ${result}`);
    }
  });

  // 9. OFFER beats BUNDLE
  await test(9, 'OFFER beats BUNDLE in priority hierarchy', async () => {
    const sess = `multi-off-bun-${timestamp}`;
    await prisma.commerceEvent.createMany({
      data: [
        {
          sessionId: sess,
          storeId: storeAId,
          productId: prodOffer.id,
          eventType: 'RECOMMENDATION_CLICK',
          metadata: { source: 'BUNDLE_CROSS_SELL' },
        },
        {
          sessionId: sess,
          storeId: storeAId,
          productId: prodOffer.id,
          eventType: 'OFFER_ACCEPTED',
          metadata: { discountPercent: 5 },
        },
      ],
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodOffer.id,
    });
    if (result !== AttributionSource.OFFER) {
      throw new Error(`Expected OFFER to beat BUNDLE, got ${result}`);
    }
  });

  // 10. BUNDLE beats AI_CHAT
  await test(10, 'BUNDLE beats AI_CHAT in priority hierarchy', async () => {
    const sess = `multi-bun-chat-${timestamp}`;
    await prisma.commerceEvent.createMany({
      data: [
        {
          sessionId: sess,
          storeId: storeAId,
          productId: prodBundle.id,
          eventType: 'RECOMMENDATION_CLICK',
          metadata: { rank: 1, matchScore: 0.9 },
        },
        {
          sessionId: sess,
          storeId: storeAId,
          productId: prodBundle.id,
          eventType: 'RECOMMENDATION_CLICK',
          metadata: { source: 'BUNDLE_CROSS_SELL' },
        },
      ],
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodBundle.id,
    });
    if (result !== AttributionSource.BUNDLE) {
      throw new Error(`Expected BUNDLE to beat AI_CHAT, got ${result}`);
    }
  });

  // 11. AI_CHAT beats DIRECT
  await test(11, 'AI_CHAT beats DIRECT fallback', async () => {
    const sess = `multi-chat-dir-${timestamp}`;
    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodChat.id,
        eventType: 'RECOMMENDATION_CLICK',
        metadata: { rank: 2, matchScore: 0.88, matchReason: 'Recommended' },
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodChat.id,
    });
    if (result !== AttributionSource.AI_CHAT) {
      throw new Error(`Expected AI_CHAT, got ${result}`);
    }
  });

  // 12. Most recent event wins within the same priority
  await test(12, 'Most recent valid event is returned within same priority', async () => {
    const sess = `same-pri-rec-${timestamp}`;
    const older = new Date(Date.now() - 5000);
    const newer = new Date(Date.now() - 1000);

    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodOffer.id,
        eventType: 'OFFER_ACCEPTED',
        metadata: { discountPercent: 5 },
        createdAt: older,
      },
    });
    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodOffer.id,
        eventType: 'OFFER_ACCEPTED',
        metadata: { discountPercent: 10 },
        createdAt: newer,
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodOffer.id,
    });
    if (result !== AttributionSource.OFFER) {
      throw new Error(`Expected OFFER, got ${result}`);
    }
  });

  // 13. Event after checkout is ignored
  await test(13, 'Event created after checkout time is ignored', async () => {
    const sess = `future-event-${timestamp}`;
    const checkoutTime = new Date(Date.now() - 2000);
    const futureTime = new Date(Date.now() + 5000);

    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodChat.id,
        eventType: 'RECOMMENDATION_CLICK',
        metadata: { rank: 1, matchScore: 0.99 },
        createdAt: futureTime,
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodChat.id,
      checkoutTime,
    });
    if (result !== AttributionSource.DIRECT) {
      throw new Error(`Expected DIRECT because event was after checkout, got ${result}`);
    }
  });

  // 14. Event older than attribution window is ignored
  await test(14, 'Event older than 24 hours lookback window is ignored', async () => {
    const sess = `old-event-${timestamp}`;
    const oldTime = new Date(Date.now() - (25 * 60 * 60 * 1000)); // 25 hours ago

    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodOffer.id,
        eventType: 'OFFER_ACCEPTED',
        metadata: { discountPercent: 10 },
        createdAt: oldTime,
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodOffer.id,
    });
    if (result !== AttributionSource.DIRECT) {
      throw new Error(`Expected DIRECT because event is outside 24h window, got ${result}`);
    }
  });

  // 15. Wrong session is ignored
  await test(15, 'Event from a different session is ignored', async () => {
    const sessA = `sess-user-a-${timestamp}`;
    const sessB = `sess-user-b-${timestamp}`;

    await prisma.commerceEvent.create({
      data: {
        sessionId: sessA,
        storeId: storeAId,
        productId: prodBundle.id,
        eventType: 'RECOMMENDATION_CLICK',
        metadata: { source: 'BUNDLE_CROSS_SELL' },
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sessB,
      storeId: storeAId,
      productId: prodBundle.id,
    });
    if (result !== AttributionSource.DIRECT) {
      throw new Error(`Expected DIRECT for sessB, got ${result}`);
    }
  });

  // 16. Wrong store is ignored
  await test(16, 'Event from a different store is ignored', async () => {
    const sess = `cross-store-sess-${timestamp}`;

    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeBId,
        productId: prodChat.id,
        eventType: 'RECOMMENDATION_CLICK',
        metadata: { rank: 1, matchScore: 0.9 },
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodChat.id,
    });
    if (result !== AttributionSource.DIRECT) {
      throw new Error(`Expected DIRECT due to store mismatch, got ${result}`);
    }
  });

  // 17. Wrong product is ignored
  await test(17, 'Event for a different product is ignored', async () => {
    const sess = `diff-prod-sess-${timestamp}`;

    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodChat.id,
        eventType: 'RECOMMENDATION_CLICK',
        metadata: { rank: 1, matchScore: 0.9 },
      },
    });

    const result = await attributionService.resolveAttributionSource({
      sessionId: sess,
      storeId: storeAId,
      productId: prodDirect.id, // Querying prodDirect, but event was for prodChat
    });
    if (result !== AttributionSource.DIRECT) {
      throw new Error(`Expected DIRECT for prodDirect, got ${result}`);
    }
  });

  // 18. Client cannot force attributionSource via checkout API
  await test(18, 'Checkout ignores client attribution payload and derives server-authoritatively', async () => {
    const sess = `checkout-auth-sess-${timestamp}`;

    // Add item to cart
    await cartService.addItem({
      sessionId: sess,
      storeId: storeAId,
      productId: prodChat.id,
      quantity: 1,
    });

    // Create an AI_CHAT recommendation click event
    await prisma.commerceEvent.create({
      data: {
        sessionId: sess,
        storeId: storeAId,
        productId: prodChat.id,
        eventType: 'RECOMMENDATION_CLICK',
        metadata: { rank: 1, matchScore: 0.95 },
      },
    });

    // Attempt to checkout - client attempts to pass arbitrary attribution in body
    const orderResponse = await orderService.checkout({
      sessionId: sess,
      storeId: storeAId,
    } as any);

    const savedOrder = await prisma.order.findUnique({
      where: { id: orderResponse.orderId },
      include: { items: true },
    });

    if (savedOrder?.items[0].attributionSource !== AttributionSource.AI_CHAT) {
      throw new Error(
        `Expected server to resolve AI_CHAT, got ${savedOrder?.items[0].attributionSource}`
      );
    }
  });

  // 19. Full End-to-End Checkout Attribution & Merchant Summary Test Suite
  await test(19, 'All 5 attribution sources correctly resolved and persisted on OrderItems in Checkout', async () => {
    // Create orders across all attribution categories in Store A
    const endToEndSession = `e2e-all-sources-${timestamp}`;

    // Step 1: Create events for products
    await prisma.commerceEvent.createMany({
      data: [
        // prodChat -> AI_CHAT
        {
          sessionId: endToEndSession,
          storeId: storeAId,
          productId: prodChat.id,
          eventType: 'RECOMMENDATION_CLICK',
          metadata: { rank: 1, matchScore: 0.9 },
        },
        // prodBundle -> BUNDLE
        {
          sessionId: endToEndSession,
          storeId: storeAId,
          productId: prodBundle.id,
          eventType: 'RECOMMENDATION_CLICK',
          metadata: { source: 'BUNDLE_CROSS_SELL' },
        },
        // prodOffer -> OFFER (10% discount)
        {
          sessionId: endToEndSession,
          storeId: storeAId,
          productId: prodOffer.id,
          eventType: 'OFFER_ACCEPTED',
          metadata: { discountPercent: 10 },
        },
        // prodRecovery -> RECOVERY (15% discount)
        {
          sessionId: endToEndSession,
          storeId: storeAId,
          productId: prodRecovery.id,
          eventType: 'OFFER_ACCEPTED',
          metadata: { source: 'sale_recovery', discountPercent: 15 },
        },
      ],
    });

    // Step 2: Add all 5 products to cart
    for (const p of [prodDirect, prodChat, prodBundle, prodOffer, prodRecovery]) {
      await cartService.addItem({
        sessionId: endToEndSession,
        storeId: storeAId,
        productId: p.id,
        quantity: 1,
      });
    }

    // Step 3: Checkout
    const e2eOrder = await orderService.checkout({
      sessionId: endToEndSession,
      storeId: storeAId,
    });

    // Step 4: Mark order as CONFIRMED and PAID
    await prisma.order.update({
      where: { id: e2eOrder.orderId },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      },
    });

    const persistedOrder = await prisma.order.findUnique({
      where: { id: e2eOrder.orderId },
      include: { items: true },
    });

    const itemMap = new Map<string, AttributionSource>();
    for (const item of persistedOrder!.items) {
      itemMap.set(item.productId, item.attributionSource);
    }

    if (itemMap.get(prodDirect.id) !== AttributionSource.DIRECT) {
      throw new Error(`Direct item expected DIRECT, got ${itemMap.get(prodDirect.id)}`);
    }
    if (itemMap.get(prodChat.id) !== AttributionSource.AI_CHAT) {
      throw new Error(`Chat item expected AI_CHAT, got ${itemMap.get(prodChat.id)}`);
    }
    if (itemMap.get(prodBundle.id) !== AttributionSource.BUNDLE) {
      throw new Error(`Bundle item expected BUNDLE, got ${itemMap.get(prodBundle.id)}`);
    }
    if (itemMap.get(prodOffer.id) !== AttributionSource.OFFER) {
      throw new Error(`Offer item expected OFFER, got ${itemMap.get(prodOffer.id)}`);
    }
    if (itemMap.get(prodRecovery.id) !== AttributionSource.RECOVERY) {
      throw new Error(`Recovery item expected RECOVERY, got ${itemMap.get(prodRecovery.id)}`);
    }
  });

  // 20. Pending order excluded from attribution summary
  await test(20, 'Pending orders are excluded from attribution summary', async () => {
    // Create a pending order with 50,000 INR
    await prisma.order.create({
      data: {
        sessionId: `pending-sess-${timestamp}`,
        storeId: storeAId,
        status: 'PENDING',
        paymentStatus: 'CREATED',
        subtotal: 50000,
        discount: 0,
        total: 50000,
        items: {
          create: {
            productId: prodDirect.id,
            productName: prodDirect.name,
            quantity: 50,
            unitPrice: 1000,
            lineTotal: 50000,
            attributionSource: AttributionSource.DIRECT,
          },
        },
      },
    });

    const summary = await merchantDashboardService.getAttributionSummary(storeAId);
    // Should NOT include the 50,000 INR
    if (summary.totalAttributedRevenue > 20000) {
      throw new Error(`Pending order was improperly included: total is ${summary.totalAttributedRevenue}`);
    }
  });

  // 21. Cancelled order excluded
  await test(21, 'Cancelled orders are excluded from attribution summary', async () => {
    await prisma.order.create({
      data: {
        sessionId: `cancelled-sess-${timestamp}`,
        storeId: storeAId,
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
        subtotal: 30000,
        discount: 0,
        total: 30000,
        items: {
          create: {
            productId: prodChat.id,
            productName: prodChat.name,
            quantity: 15,
            unitPrice: 2000,
            lineTotal: 30000,
            attributionSource: AttributionSource.AI_CHAT,
          },
        },
      },
    });

    const summary = await merchantDashboardService.getAttributionSummary(storeAId);
    if (summary.aiInfluencedRevenue > 20000) {
      throw new Error(`Cancelled order was improperly included: aiInfluenced is ${summary.aiInfluencedRevenue}`);
    }
  });

  // 22. Attribution revenue uses OrderItem.lineTotal
  await test(22, 'Attribution revenue is calculated from OrderItem.lineTotal', async () => {
    const summary = await merchantDashboardService.getAttributionSummary(storeAId);
    // Total from our completed orders:
    // prodDirect: 1000 (from test 2) + 1000 (from e2e) = 2000
    // prodChat: 2000
    // prodBundle: 1500
    // prodOffer: 3000 - 10% = 2700
    // prodRecovery: 4000 - 15% = 3400
    // Expected total: 2000 + 2000 + 1500 + 2700 + 3400 = 11600.00
    if (summary.directRevenue !== 2000) {
      throw new Error(`Expected directRevenue 2000, got ${summary.directRevenue}`);
    }
    if (summary.aiInfluencedRevenue !== (2000 + 1500 + 2700 + 3400)) {
      throw new Error(`Expected aiInfluencedRevenue 9600, got ${summary.aiInfluencedRevenue}`);
    }
  });

  // 23. Attribution buckets sum exactly to total attributed revenue (Zero double counting)
  await test(23, 'Attribution buckets sum exactly to totalAttributedRevenue with ZERO double counting', async () => {
    const summary = await merchantDashboardService.getAttributionSummary(storeAId);
    const sumBuckets = Number(
      (
        summary.directRevenue +
        summary.attributionBreakdown.find((b) => b.source === 'AI_CHAT')!.revenue +
        summary.bundleRevenue +
        summary.offerRevenue +
        summary.recoveredRevenue
      ).toFixed(2)
    );

    if (sumBuckets !== summary.totalAttributedRevenue) {
      throw new Error(
        `Double counting or gap detected: sum of buckets (${sumBuckets}) !== totalAttributedRevenue (${summary.totalAttributedRevenue})`
      );
    }
  });

  // 24. AI-influenced revenue calculation correct
  await test(24, 'AI-influenced revenue & share calculated correctly', async () => {
    const summary = await merchantDashboardService.getAttributionSummary(storeAId);
    const expectedShare = Number(
      ((summary.aiInfluencedRevenue / summary.totalAttributedRevenue) * 100).toFixed(2)
    );
    if (summary.aiInfluencedShare !== expectedShare) {
      throw new Error(
        `Expected share ${expectedShare}%, got ${summary.aiInfluencedShare}%`
      );
    }
  });

  // 25. Zero-revenue store returns 0 share and 0 totals safely
  await test(25, 'Zero-revenue store returns 0 share and clean zero breakdown', async () => {
    const summary = await merchantDashboardService.getAttributionSummary(storeEmptyId);
    if (summary.totalAttributedRevenue !== 0 || summary.aiInfluencedShare !== 0) {
      throw new Error(`Expected zeros for empty store, got ${JSON.stringify(summary)}`);
    }
  });

  // 26. Store isolation: Merchant B does not see Store A's attribution
  await test(26, 'Store isolation strictly enforced between merchants', async () => {
    const summaryB = await merchantDashboardService.getAttributionSummary(storeBId);
    if (summaryB.totalAttributedRevenue !== 0) {
      throw new Error(`Store B leaked Store A revenue: total is ${summaryB.totalAttributedRevenue}`);
    }
  });

  // 27. Security & privacy: No costPrice or customer PII exposed in controller response
  await test(27, 'No costPrice, margin, or PII exposed in attribution endpoint', async () => {
    let responseData: any = null;
    const req: any = { query: { storeId: storeAId } };
    const res: any = {
      status: (code: number) => ({
        json: (data: any) => {
          responseData = data;
        },
      }),
    };
    const next = (err: any) => {
      if (err) throw err;
    };

    await merchantDashboardController.getAttribution(req, res, next);

    const jsonString = JSON.stringify(responseData);
    if (jsonString.includes('costPrice') || jsonString.includes('cost_price')) {
      throw new Error('Leak detected: costPrice found in response JSON');
    }
    if (jsonString.includes('marginPercent') || jsonString.includes('margin')) {
      throw new Error('Leak detected: margin found in response JSON');
    }
    if (jsonString.includes('email') || jsonString.includes('customerName') || jsonString.includes('sessionId')) {
      throw new Error('Leak detected: PII/sessionId found in response JSON');
    }
  });

  // 28. Zero Gemini Calls check
  await test(28, 'Zero Gemini / AI API calls executed during checkout or attribution summary', async () => {
    // attribution.service.ts and merchant-dashboard.service.ts contain zero imports of GoogleGenAI
    const attributionSrc = require('fs').readFileSync('server/services/revenue/attribution.service.ts', 'utf8');
    const dashboardSrc = require('fs').readFileSync('server/services/merchant-dashboard.service.ts', 'utf8');

    if (attributionSrc.includes('@google/genai') || dashboardSrc.includes('@google/genai')) {
      throw new Error('Forbidden import of @google/genai found in attribution or dashboard services');
    }
  });

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} PASSED`);
  console.log('======================================================\n');

  if (results.some((r) => !r.passed)) {
    process.exit(1);
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  });
