import { prisma } from '../server/db/prisma';
import { merchantDashboardService as backendService } from '../server/services/merchant-dashboard.service';
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
  console.log('OPTICOMMERCE ISSUE #4: MERCHANT ORDER MANAGEMENT VERIFICATION');
  console.log('==================================================\n');

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

  // 1. Create Merchant A and Store A
  const merchantA = await prisma.merchant.create({
    data: {
      name: `Merchant A ${timestamp}`,
      email: `merch-a-${timestamp}@example.com`,
      store: {
        create: {
          name: `Store A ${timestamp}`,
          slug: `store-a-${timestamp}`,
          status: 'PUBLISHED',
        },
      },
    },
    include: { store: true },
  });
  const storeA = merchantA.store!;

  // 2. Create Merchant B and Store B
  const merchantB = await prisma.merchant.create({
    data: {
      name: `Merchant B ${timestamp}`,
      email: `merch-b-${timestamp}@example.com`,
      store: {
        create: {
          name: `Store B ${timestamp}`,
          slug: `store-b-${timestamp}`,
          status: 'PUBLISHED',
        },
      },
    },
    include: { store: true },
  });
  const storeB = merchantB.store!;

  // 3. Create products
  const productA = await prisma.product.create({
    data: {
      storeId: storeA.id,
      name: `Product A ${timestamp}`,
      category: 'Electronics',
      price: 2000,
      costPrice: 1000,
      stock: 10,
      status: 'PUBLISHED',
    },
  });

  const productB = await prisma.product.create({
    data: {
      storeId: storeB.id,
      name: `Product B ${timestamp}`,
      category: 'Books',
      price: 500,
      costPrice: 200,
      stock: 20,
      status: 'PUBLISHED',
    },
  });

  // 4. Create orders for Store A:
  // Order A1: CONFIRMED + PAID (READY_TO_PROCESS)
  const orderA1 = await prisma.order.create({
    data: {
      sessionId: `sess_a1_${timestamp}`,
      storeId: storeA.id,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      subtotal: 4000,
      discount: 400,
      total: 3600,
      currency: 'INR',
      razorpayOrderId: `order_rp_a1_${timestamp}`,
      razorpayPaymentId: `pay_rp_a1_${timestamp}`,
      items: {
        create: [
          {
            productId: productA.id,
            productName: productA.name,
            quantity: 2,
            unitPrice: 2000,
            discountPercent: 10,
            discountAmount: 400,
            lineTotal: 3600,
            attributionSource: 'DIRECT',
          },
        ],
      },
    },
    include: { items: true },
  });

  // Order A2: PENDING + CREATED (PENDING_PAYMENT)
  const orderA2 = await prisma.order.create({
    data: {
      sessionId: `sess_a2_${timestamp}`,
      storeId: storeA.id,
      status: 'PENDING',
      paymentStatus: 'CREATED',
      subtotal: 2000,
      discount: 0,
      total: 2000,
      currency: 'INR',
      razorpayOrderId: `order_rp_a2_${timestamp}`,
      items: {
        create: [
          {
            productId: productA.id,
            productName: productA.name,
            quantity: 1,
            unitPrice: 2000,
            discountPercent: 0,
            discountAmount: 0,
            lineTotal: 2000,
            attributionSource: 'AI_CHAT',
          },
        ],
      },
    },
  });

  // 5. Create order for Store B
  const orderB1 = await prisma.order.create({
    data: {
      sessionId: `sess_b1_${timestamp}`,
      storeId: storeB.id,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      subtotal: 1000,
      discount: 0,
      total: 1000,
      currency: 'INR',
      razorpayOrderId: `order_rp_b1_${timestamp}`,
      razorpayPaymentId: `pay_rp_b1_${timestamp}`,
      items: {
        create: [
          {
            productId: productB.id,
            productName: productB.name,
            quantity: 2,
            unitPrice: 500,
            discountPercent: 0,
            discountAmount: 0,
            lineTotal: 1000,
            attributionSource: 'BUNDLE',
          },
        ],
      },
    },
  });

  // Mock Express Req/Res helpers
  function mockReqRes(reqData: any) {
    const req = {
      query: {},
      params: {},
      body: {},
      headers: {},
      merchant: null,
      ...reqData,
    };
    let statusCode = 200;
    let responseBody: any = null;

    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        responseBody = data;
        return res;
      },
      getStatusCode: () => statusCode,
      getBody: () => responseBody,
    };

    const next = (err?: any) => {
      if (err) {
        statusCode = err.statusCode || err.status || 500;
        responseBody = { success: false, error: { message: err.message } };
      }
    };

    return { req, res, next };
  }

  // TEST 1: Cross-tenant isolation - Merchant A cannot query Store B's orders
  await test(1, 'Cross-Tenant: Merchant A cannot query Store B orders', async () => {
    const { req, res, next } = mockReqRes({
      merchant: { id: merchantA.id, email: merchantA.email, name: merchantA.name },
      query: { storeId: storeB.id },
    });

    await merchantDashboardController.getOrders(req as any, res, next);
    if (res.getStatusCode() !== 403) {
      throw new Error(`Expected 403 Forbidden, got ${res.getStatusCode()}: ${JSON.stringify(res.getBody())}`);
    }
  });

  // TEST 2: Cross-tenant isolation - Merchant A cannot view Store B order detail
  await test(2, 'Cross-Tenant: Merchant A cannot view Store B order detail', async () => {
    const { req, res, next } = mockReqRes({
      merchant: { id: merchantA.id, email: merchantA.email, name: merchantA.name },
      params: { orderId: orderB1.id },
    });

    await merchantDashboardController.getOrderDetail(req as any, res, next);
    if (res.getStatusCode() !== 403 && res.getStatusCode() !== 404) {
      throw new Error(`Expected 403 or 404, got ${res.getStatusCode()}`);
    }
  });

  // TEST 3: Cross-tenant isolation - Merchant A cannot cancel Store B order
  await test(3, 'Cross-Tenant: Merchant A cannot cancel Store B order', async () => {
    const { req, res, next } = mockReqRes({
      merchant: { id: merchantA.id, email: merchantA.email, name: merchantA.name },
      params: { orderId: orderB1.id },
    });

    await merchantDashboardController.cancelOrder(req as any, res, next);
    if (res.getStatusCode() !== 403 && res.getStatusCode() !== 404) {
      throw new Error(`Expected 403 or 404, got ${res.getStatusCode()}`);
    }
  });

  // TEST 4: Missing or invalid storeId is rejected
  await test(4, 'Missing storeId query parameter is rejected with 400', async () => {
    const { req, res, next } = mockReqRes({
      merchant: { id: merchantA.id, email: merchantA.email, name: merchantA.name },
      query: {},
    });

    await merchantDashboardController.getOrders(req as any, res, next);
    if (res.getStatusCode() !== 400) {
      throw new Error(`Expected 400 Bad Request, got ${res.getStatusCode()}`);
    }
  });

  // TEST 5: Retrieval correctness for Merchant A
  await test(5, 'Merchant A retrieves only Store A orders with accurate KPI counts', async () => {
    const { req, res, next } = mockReqRes({
      merchant: { id: merchantA.id, email: merchantA.email, name: merchantA.name },
      query: { storeId: storeA.id },
    });

    await merchantDashboardController.getOrders(req as any, res, next);
    if (res.getStatusCode() !== 200) {
      throw new Error(`Expected 200, got ${res.getStatusCode()}`);
    }
    const body = res.getBody();
    if (!body.success || !body.data) {
      throw new Error(`Failed response format: ${JSON.stringify(body)}`);
    }

    const { orders, counts } = body.data;
    if (orders.length !== 2) {
      throw new Error(`Expected 2 orders, got ${orders.length}`);
    }

    // Verify all returned orders belong strictly to Store A
    for (const ord of orders) {
      if (ord.id === orderB1.id) {
        throw new Error(`Tenant leak! Found Store B order in Store A list`);
      }
    }

    if (counts.all !== 2 || counts.readyToProcess !== 1 || counts.pendingPayment !== 1) {
      throw new Error(`Unexpected counts: ${JSON.stringify(counts)}`);
    }
  });

  // TEST 6: Status filtering
  await test(6, 'Filter by status: READY_TO_PROCESS returns only confirmed paid orders', async () => {
    const { req, res, next } = mockReqRes({
      merchant: { id: merchantA.id, email: merchantA.email, name: merchantA.name },
      query: { storeId: storeA.id, status: 'READY_TO_PROCESS' },
    });

    await merchantDashboardController.getOrders(req as any, res, next);
    const body = res.getBody();
    const orders = body.data.orders;
    if (orders.length !== 1 || orders[0].id !== orderA1.id) {
      throw new Error(`Expected only orderA1, got ${JSON.stringify(orders.map((o: any) => o.id))}`);
    }
  });

  // TEST 7: Internal merchant economics are stripped (NO sensitive data leak)
  await test(7, 'Security: Internal economics (costPrice, expectedProfit, etc.) are stripped', async () => {
    const result = await backendService.getStoreOrderById(orderA1.id, merchantA.id);
    if (!result) throw new Error('Order not found');

    const rawJson = JSON.stringify(result);
    if (rawJson.includes('costPrice')) {
      throw new Error('Leak detected: costPrice found in order output!');
    }
    if (rawJson.includes('expectedProfit')) {
      throw new Error('Leak detected: expectedProfit found in order output!');
    }
    if (rawJson.includes('purchaseProbability')) {
      throw new Error('Leak detected: purchaseProbability found in order output!');
    }
  });

  // TEST 8: Safe cancellation and transactional stock restoration
  await test(8, 'Transactional cancellation restores inventory and maintains payment invariant', async () => {
    // Current stock of productA is 10
    const initialProduct = await prisma.product.findUnique({ where: { id: productA.id } });
    const initialStock = initialProduct!.stock;

    // Order A2 has quantity 1 of productA
    const { req, res, next } = mockReqRes({
      merchant: { id: merchantA.id, email: merchantA.email, name: merchantA.name },
      params: { orderId: orderA2.id },
    });

    await merchantDashboardController.cancelOrder(req as any, res, next);
    if (res.getStatusCode() !== 200) {
      throw new Error(`Expected 200, got ${res.getStatusCode()}: ${JSON.stringify(res.getBody())}`);
    }

    // Check stock was incremented by 1
    const updatedProduct = await prisma.product.findUnique({ where: { id: productA.id } });
    if (updatedProduct!.stock !== initialStock + 1) {
      throw new Error(`Expected stock to be ${initialStock + 1}, got ${updatedProduct!.stock}`);
    }

    // Check order status is CANCELLED
    const cancelledOrder = await prisma.order.findUnique({ where: { id: orderA2.id } });
    if (cancelledOrder!.status !== 'CANCELLED') {
      throw new Error(`Expected status CANCELLED, got ${cancelledOrder!.status}`);
    }

    // Invariant: paymentStatus must NOT be PAID
    if (cancelledOrder!.paymentStatus === 'PAID') {
      throw new Error(`Payment invariant violation: cancelled order was given PAID status!`);
    }

    // Test duplicate cancellation is rejected
    const { req: reqDup, res: resDup, next: nextDup } = mockReqRes({
      merchant: { id: merchantA.id, email: merchantA.email, name: merchantA.name },
      params: { orderId: orderA2.id },
    });
    await merchantDashboardController.cancelOrder(reqDup as any, resDup, nextDup);
    if (resDup.getStatusCode() !== 400) {
      throw new Error(`Expected duplicate cancellation to be rejected with 400, got ${resDup.getStatusCode()}`);
    }
  });

  // TEST 9: Empty Store zero-data state
  await test(9, 'Empty store returns clean empty state without crashing', async () => {
    const emptyMerchant = await prisma.merchant.create({
      data: {
        name: `Empty Merchant ${timestamp}`,
        email: `empty-${timestamp}@example.com`,
        store: {
          create: {
            name: `Empty Store ${timestamp}`,
            slug: `empty-store-${timestamp}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    });

    const { req, res, next } = mockReqRes({
      merchant: { id: emptyMerchant.id, email: emptyMerchant.email, name: emptyMerchant.name },
      query: { storeId: emptyMerchant.store!.id },
    });

    await merchantDashboardController.getOrders(req as any, res, next);
    if (res.getStatusCode() !== 200) {
      throw new Error(`Expected 200, got ${res.getStatusCode()}`);
    }

    const body = res.getBody();
    if (body.data.orders.length !== 0 || body.data.counts.all !== 0) {
      throw new Error(`Expected 0 orders for empty store, got ${body.data.orders.length}`);
    }
  });

  // Summary
  console.log('\n==================================================');
  console.log(`RESULTS: ${results.filter((r) => r.passed).length}/${results.length} PASSED`);
  console.log('==================================================\n');

  if (results.some((r) => !r.passed)) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error('Fatal error during test execution:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
