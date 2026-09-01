import { prisma } from '../server/db/prisma';
import { orderService } from '../server/services/order.service';
import { cartService } from '../server/services/cart.service';
import { paymentService } from '../server/services/payment/payment.service';
import { razorpayClient } from '../server/services/payment/razorpay.client';
import crypto from 'crypto';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runTests() {
  const results: TestResult[] = [];

  console.log('\n==================================================');
  console.log('PHASE 6D — RAZORPAY PAYMENT INTEGRATION VERIFICATION');
  console.log('==================================================\n');

  // Setup: Find or create a test store and products
  const storeA = await prisma.store.findFirst({
    where: { status: 'PUBLISHED' },
  });

  if (!storeA) {
    throw new Error('No published store found for verification tests.');
  }

  // Find or create store B for isolation tests
  let storeB = await prisma.store.findFirst({
    where: { id: { not: storeA.id } },
  });

  if (!storeB) {
    const merchantB = await prisma.merchant.create({
      data: {
        name: 'Store B Merchant',
        email: `storeb-${Date.now()}@example.com`,
        store: {
          create: {
            name: 'Store B Flagship',
            slug: `store-b-payment-${Date.now()}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    });
    storeB = merchantB.store!;
  }

  // Create isolated test products for Store A
  const testProduct1 = await prisma.product.create({
    data: {
      storeId: storeA.id,
      name: `Premium Smart Watch ${Date.now()}`,
      category: 'Wearables',
      price: 15000,
      costPrice: 9000,
      stock: 50,
      status: 'PUBLISHED',
      images: ['https://example.com/watch.jpg'],
      tags: ['watch', 'wearable'],
    },
  });

  const testProduct2 = await prisma.product.create({
    data: {
      storeId: storeA.id,
      name: `Wireless Earbuds Pro ${Date.now()}`,
      category: 'Audio',
      price: 5000,
      costPrice: 2500,
      stock: 50,
      status: 'PUBLISHED',
      images: ['https://example.com/earbuds.jpg'],
      tags: ['audio', 'earbuds'],
    },
  });

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

  const session1 = `sess_pay_test_${Date.now()}_1`;
  const session2 = `sess_pay_test_${Date.now()}_2`;

  let baseOrder: any = null;

  // --- Test Group 1: createPaymentOrder Validation & Isolation ---

  await test(1, 'POST /api/payments/create-order fails with 400 when body/input is missing', async () => {
    try {
      await paymentService.createPaymentOrder(null as any);
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(2, 'POST /api/payments/create-order fails with 400 when orderId is missing/empty', async () => {
    try {
      await paymentService.createPaymentOrder({ orderId: '', sessionId: session1, storeId: storeA.id });
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(3, 'POST /api/payments/create-order fails with 400 when sessionId is missing/empty', async () => {
    try {
      await paymentService.createPaymentOrder({ orderId: 'ord_123', sessionId: '', storeId: storeA.id });
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(4, 'POST /api/payments/create-order fails with 400 when storeId is missing/empty', async () => {
    try {
      await paymentService.createPaymentOrder({ orderId: 'ord_123', sessionId: session1, storeId: '' });
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(5, 'POST /api/payments/create-order fails with 404 for non-existent orderId', async () => {
    try {
      await paymentService.createPaymentOrder({ orderId: 'non_existent_ord_id', sessionId: session1, storeId: storeA.id });
      throw new Error('Expected 404 AppError');
    } catch (err: any) {
      if (err.statusCode !== 404) throw new Error(`Expected status 404, got ${err.statusCode}`);
    }
  });

  // Setup a real order for session 1
  await cartService.addItem({
    sessionId: session1,
    storeId: storeA.id,
    productId: testProduct1.id,
    quantity: 2,
  });

  baseOrder = await orderService.checkout({
    sessionId: session1,
    storeId: storeA.id,
  });

  await test(6, 'POST /api/payments/create-order fails with 404 when sessionId does not match order owner', async () => {
    try {
      await paymentService.createPaymentOrder({ orderId: baseOrder.orderId, sessionId: session2, storeId: storeA.id });
      throw new Error('Expected 404 AppError');
    } catch (err: any) {
      if (err.statusCode !== 404) throw new Error(`Expected status 404, got ${err.statusCode}`);
    }
  });

  await test(7, 'POST /api/payments/create-order fails with 404 when storeId does not match order store', async () => {
    try {
      await paymentService.createPaymentOrder({ orderId: baseOrder.orderId, sessionId: session1, storeId: storeB!.id });
      throw new Error('Expected 404 AppError');
    } catch (err: any) {
      if (err.statusCode !== 404) throw new Error(`Expected status 404, got ${err.statusCode}`);
    }
  });

  await test(8, 'POST /api/payments/create-order fails with 400 for CANCELLED order', async () => {
    const cancelledOrder = await prisma.order.create({
      data: {
        sessionId: session1,
        storeId: storeA.id,
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
        subtotal: 1000,
        discount: 0,
        total: 1000,
        currency: 'INR',
      },
    });

    try {
      await paymentService.createPaymentOrder({ orderId: cancelledOrder.id, sessionId: session1, storeId: storeA.id });
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(9, 'POST /api/payments/create-order calculates amount strictly from database total in paise', async () => {
    const paymentOrder = await paymentService.createPaymentOrder({
      orderId: baseOrder.orderId,
      sessionId: session1,
      storeId: storeA.id,
    });

    // baseOrder total: 15000 * 2 = 30000. In paise = 3000000
    const expectedPaise = Math.round(Number(baseOrder.total) * 100);
    if (paymentOrder.amount !== expectedPaise) {
      throw new Error(`Expected amount ${expectedPaise} paise, got ${paymentOrder.amount}`);
    }
    if (paymentOrder.currency !== 'INR') {
      throw new Error(`Expected currency INR, got ${paymentOrder.currency}`);
    }
    if (!paymentOrder.razorpayOrderId || !paymentOrder.razorpayOrderId.startsWith('order_')) {
      throw new Error(`Invalid razorpayOrderId format: ${paymentOrder.razorpayOrderId}`);
    }
    if (!paymentOrder.keyId) {
      throw new Error('Missing keyId in payment order response');
    }
  });

  await test(10, 'POST /api/payments/create-order stores razorpayOrderId on the Order model', async () => {
    const dbOrder = await prisma.order.findUnique({
      where: { id: baseOrder.orderId },
    });

    if (!dbOrder?.razorpayOrderId) {
      throw new Error('razorpayOrderId was not persisted on the Order record');
    }
  });

  await test(11, 'POST /api/payments/create-order is idempotent and reuses existing razorpayOrderId', async () => {
    const firstCall = await paymentService.createPaymentOrder({
      orderId: baseOrder.orderId,
      sessionId: session1,
      storeId: storeA.id,
    });

    const secondCall = await paymentService.createPaymentOrder({
      orderId: baseOrder.orderId,
      sessionId: session1,
      storeId: storeA.id,
    });

    if (firstCall.razorpayOrderId !== secondCall.razorpayOrderId) {
      throw new Error(`Expected same razorpayOrderId on retry, got ${firstCall.razorpayOrderId} vs ${secondCall.razorpayOrderId}`);
    }
  });

  await test(12, 'POST /api/payments/create-order logs clean non-blocking PAYMENT_INITIATED event', async () => {
    const events = await prisma.commerceEvent.findMany({
      where: {
        sessionId: session1,
        storeId: storeA.id,
        eventType: 'PAYMENT_INITIATED',
      },
    });

    if (events.length === 0) {
      throw new Error('No PAYMENT_INITIATED event recorded');
    }
    const meta = (events[0].metadata || {}) as any;
    if (meta.orderId !== baseOrder.orderId) {
      throw new Error(`Expected orderId in event metadata, got ${meta.orderId}`);
    }
  });

  // --- Test Group 2: verifyPayment Validation & Security ---

  await test(13, 'POST /api/payments/verify fails with 400 on missing request body/input', async () => {
    try {
      await paymentService.verifyPayment(null as any);
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(14, 'POST /api/payments/verify fails with 400 when orderId is missing', async () => {
    try {
      await paymentService.verifyPayment({
        orderId: '',
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'sig_123',
        sessionId: session1,
        storeId: storeA.id,
      });
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(15, 'POST /api/payments/verify fails with 400 when razorpayOrderId is missing', async () => {
    try {
      await paymentService.verifyPayment({
        orderId: baseOrder.orderId,
        razorpayOrderId: '',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'sig_123',
        sessionId: session1,
        storeId: storeA.id,
      });
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(16, 'POST /api/payments/verify fails with 400 when razorpayPaymentId is missing', async () => {
    try {
      await paymentService.verifyPayment({
        orderId: baseOrder.orderId,
        razorpayOrderId: 'order_123',
        razorpayPaymentId: '',
        razorpaySignature: 'sig_123',
        sessionId: session1,
        storeId: storeA.id,
      });
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(17, 'POST /api/payments/verify fails with 400 when razorpaySignature is missing', async () => {
    try {
      await paymentService.verifyPayment({
        orderId: baseOrder.orderId,
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: '',
        sessionId: session1,
        storeId: storeA.id,
      });
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(18, 'POST /api/payments/verify fails with 404 for non-existent orderId', async () => {
    try {
      await paymentService.verifyPayment({
        orderId: 'non_existent_order_id',
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'sig_123',
        sessionId: session1,
        storeId: storeA.id,
      });
      throw new Error('Expected 404 AppError');
    } catch (err: any) {
      if (err.statusCode !== 404) throw new Error(`Expected status 404, got ${err.statusCode}`);
    }
  });

  await test(19, 'POST /api/payments/verify fails with 404 for session mismatch', async () => {
    try {
      await paymentService.verifyPayment({
        orderId: baseOrder.orderId,
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'sig_123',
        sessionId: session2,
        storeId: storeA.id,
      });
      throw new Error('Expected 404 AppError');
    } catch (err: any) {
      if (err.statusCode !== 404) throw new Error(`Expected status 404, got ${err.statusCode}`);
    }
  });

  await test(20, 'POST /api/payments/verify fails with 404 for store mismatch', async () => {
    try {
      await paymentService.verifyPayment({
        orderId: baseOrder.orderId,
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'sig_123',
        sessionId: session1,
        storeId: storeB!.id,
      });
      throw new Error('Expected 404 AppError');
    } catch (err: any) {
      if (err.statusCode !== 404) throw new Error(`Expected status 404, got ${err.statusCode}`);
    }
  });

  await test(21, 'POST /api/payments/verify fails with 400 if razorpayOrderId does not match order record', async () => {
    try {
      await paymentService.verifyPayment({
        orderId: baseOrder.orderId,
        razorpayOrderId: 'order_mismatched_999999',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'sig_123',
        sessionId: session1,
        storeId: storeA.id,
      });
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  await test(22, 'POST /api/payments/verify with INVALID signature fails with 400 and marks payment FAILED', async () => {
    const dbOrder = await prisma.order.findUnique({ where: { id: baseOrder.orderId } });
    const rzpOrderId = dbOrder!.razorpayOrderId!;

    try {
      await paymentService.verifyPayment({
        orderId: baseOrder.orderId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: 'pay_test_invalid',
        razorpaySignature: 'definitely_invalid_tampered_signature_hex_1234567890',
        sessionId: session1,
        storeId: storeA.id,
      });
      throw new Error('Expected 400 verification failure');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }

    const updated = await prisma.order.findUnique({ where: { id: baseOrder.orderId } });
    if (updated?.paymentStatus !== 'FAILED') {
      throw new Error(`Expected paymentStatus FAILED, got ${updated?.paymentStatus}`);
    }
    if (updated?.status !== 'PENDING') {
      throw new Error(`Expected status PENDING, got ${updated?.status}`);
    }
  });

  await test(23, 'POST /api/payments/verify with VALID HMAC signature marks payment PAID and order CONFIRMED', async () => {
    const dbOrder = await prisma.order.findUnique({ where: { id: baseOrder.orderId } });
    const rzpOrderId = dbOrder!.razorpayOrderId!;
    const paymentId = `pay_valid_${Date.now()}`;

    // Compute legitimate HMAC-SHA256 signature
    const secret = razorpayClient.getKeySecret();
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${paymentId}`)
      .digest('hex');

    const result = await paymentService.verifyPayment({
      orderId: baseOrder.orderId,
      razorpayOrderId: rzpOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: validSignature,
      sessionId: session1,
      storeId: storeA.id,
    });

    if (result.status !== 'CONFIRMED' || result.paymentStatus !== 'PAID') {
      throw new Error(`Expected CONFIRMED & PAID, got status: ${result.status}, paymentStatus: ${result.paymentStatus}`);
    }
    if (result.razorpayPaymentId !== paymentId) {
      throw new Error(`Expected paymentId ${paymentId}, got ${result.razorpayPaymentId}`);
    }

    const confirmedDbOrder = await prisma.order.findUnique({ where: { id: baseOrder.orderId } });
    if (confirmedDbOrder?.status !== 'CONFIRMED' || confirmedDbOrder?.paymentStatus !== 'PAID') {
      throw new Error(`Database record not updated properly to CONFIRMED & PAID`);
    }
  });

  await test(24, 'POST /api/payments/verify is idempotent for already PAID order', async () => {
    const dbOrder = await prisma.order.findUnique({ where: { id: baseOrder.orderId } });
    const rzpOrderId = dbOrder!.razorpayOrderId!;
    const paymentId = dbOrder!.razorpayPaymentId!;

    const secret = razorpayClient.getKeySecret();
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${paymentId}`)
      .digest('hex');

    const result = await paymentService.verifyPayment({
      orderId: baseOrder.orderId,
      razorpayOrderId: rzpOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: validSignature,
      sessionId: session1,
      storeId: storeA.id,
    });

    if (result.status !== 'CONFIRMED' || result.paymentStatus !== 'PAID') {
      throw new Error('Idempotent re-verification returned incorrect status');
    }
  });

  await test(25, 'POST /api/payments/verify emits single PURCHASE event upon payment confirmation', async () => {
    const purchaseEvents = await prisma.commerceEvent.findMany({
      where: {
        sessionId: session1,
        storeId: storeA.id,
        eventType: 'PURCHASE',
      },
    });

    const matching = purchaseEvents.filter((e) => ((e.metadata as any)?.orderId === baseOrder.orderId));
    if (matching.length !== 1) {
      throw new Error(`Expected exactly 1 PURCHASE event for verified order, found ${matching.length}`);
    }
  });

  // --- Test Group 3: Webhook Verification & Resilience ---

  await test(26, 'POST /api/payments/webhook fails with 400 on invalid webhook signature', async () => {
    const webhookPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_wh_test_1',
            order_id: 'order_wh_test_1',
            amount: 500000,
            status: 'captured',
          },
        },
      },
    });

    try {
      await paymentService.handleWebhook(
        webhookPayload,
        'invalid_webhook_signature_hex_123',
        JSON.parse(webhookPayload)
      );
      throw new Error('Expected 400 AppError');
    } catch (err: any) {
      if (err.statusCode !== 400) throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  });

  // Setup another order for webhook test
  const sessionWh = `sess_wh_${Date.now()}`;
  await cartService.addItem({
    sessionId: sessionWh,
    storeId: storeA.id,
    productId: testProduct2.id,
    quantity: 1,
  });

  const whOrder = await orderService.checkout({
    sessionId: sessionWh,
    storeId: storeA.id,
  });

  const whPayOrder = await paymentService.createPaymentOrder({
    orderId: whOrder.orderId,
    sessionId: sessionWh,
    storeId: storeA.id,
  });

  await test(27, 'POST /api/payments/webhook handles payment.captured and updates order to PAID & CONFIRMED', async () => {
    const webhookSecret = razorpayClient.getWebhookSecret();
    const eventObj = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_wh_cap_${Date.now()}`,
            order_id: whPayOrder.razorpayOrderId,
            amount: Math.round(Number(whOrder.total) * 100),
            status: 'captured',
          },
        },
      },
    };
    const rawBody = JSON.stringify(eventObj);
    const validWhSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const result = await paymentService.handleWebhook(
      rawBody,
      validWhSignature,
      eventObj
    );

    if (!result.received || !result.processed) {
      throw new Error('Webhook was not processed properly');
    }

    const updated = await prisma.order.findUnique({ where: { id: whOrder.orderId } });
    if (updated?.status !== 'CONFIRMED' || updated?.paymentStatus !== 'PAID') {
      throw new Error(`Expected order to be CONFIRMED & PAID via webhook, got ${updated?.status} & ${updated?.paymentStatus}`);
    }
  });

  await test(28, 'POST /api/payments/webhook handles payment.failed and updates order to FAILED', async () => {
    // Setup order for failed webhook test
    const sessionWhFail = `sess_wh_fail_${Date.now()}`;
    await cartService.addItem({
      sessionId: sessionWhFail,
      storeId: storeA.id,
      productId: testProduct2.id,
      quantity: 1,
    });

    const whFailOrder = await orderService.checkout({
      sessionId: sessionWhFail,
      storeId: storeA.id,
    });

    const whFailPayOrder = await paymentService.createPaymentOrder({
      orderId: whFailOrder.orderId,
      sessionId: sessionWhFail,
      storeId: storeA.id,
    });

    const webhookSecret = razorpayClient.getWebhookSecret();
    const eventObj = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: `pay_wh_fail_${Date.now()}`,
            order_id: whFailPayOrder.razorpayOrderId,
            amount: Math.round(Number(whFailOrder.total) * 100),
            status: 'failed',
          },
        },
      },
    };
    const rawBody = JSON.stringify(eventObj);
    const validWhSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const result = await paymentService.handleWebhook(
      rawBody,
      validWhSignature,
      eventObj
    );

    if (!result.received || !result.processed) {
      throw new Error('Failed payment webhook was not processed properly');
    }

    const updated = await prisma.order.findUnique({ where: { id: whFailOrder.orderId } });
    if (updated?.paymentStatus !== 'FAILED') {
      throw new Error(`Expected order paymentStatus to be FAILED via webhook, got ${updated?.paymentStatus}`);
    }
  });

  await test(29, 'POST /api/payments/webhook is idempotent on duplicate event delivery', async () => {
    const webhookSecret = razorpayClient.getWebhookSecret();
    const eventObj = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_wh_dup_${Date.now()}`,
            order_id: whPayOrder.razorpayOrderId,
            amount: Math.round(Number(whOrder.total) * 100),
            status: 'captured',
          },
        },
      },
    };
    const rawBody = JSON.stringify(eventObj);
    const validWhSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Send duplicate webhook
    const result = await paymentService.handleWebhook(
      rawBody,
      validWhSignature,
      eventObj
    );

    if (!result.received || !result.processed) {
      throw new Error('Duplicate webhook failed handling');
    }
  });

  // --- Test Group 4: Inventory Invariant ---

  await test(30, 'Payment verification does NOT double-decrement stock (decremented only once in Phase 6C)', async () => {
    const initialProduct = await prisma.product.findUnique({ where: { id: testProduct1.id } });
    const initialStock = initialProduct!.stock;

    const sessionInv = `sess_inv_${Date.now()}`;
    await cartService.addItem({
      sessionId: sessionInv,
      storeId: storeA.id,
      productId: testProduct1.id,
      quantity: 3,
    });

    // 1. Checkout decrements stock by 3
    const invOrder = await orderService.checkout({
      sessionId: sessionInv,
      storeId: storeA.id,
    });

    const stockAfterCheckout = await prisma.product.findUnique({ where: { id: testProduct1.id } });
    if (stockAfterCheckout!.stock !== initialStock - 3) {
      throw new Error(`Stock after checkout was ${stockAfterCheckout!.stock}, expected ${initialStock - 3}`);
    }

    // 2. Create payment order & verify
    const invPayOrder = await paymentService.createPaymentOrder({
      orderId: invOrder.orderId,
      sessionId: sessionInv,
      storeId: storeA.id,
    });

    const paymentId = `pay_inv_${Date.now()}`;
    const secret = razorpayClient.getKeySecret();
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`${invPayOrder.razorpayOrderId}|${paymentId}`)
      .digest('hex');

    await paymentService.verifyPayment({
      orderId: invOrder.orderId,
      razorpayOrderId: invPayOrder.razorpayOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: sig,
      sessionId: sessionInv,
      storeId: storeA.id,
    });

    // 3. Stock must remain unchanged after payment verification!
    const stockAfterPayment = await prisma.product.findUnique({ where: { id: testProduct1.id } });
    if (stockAfterPayment!.stock !== initialStock - 3) {
      throw new Error(`Stock was altered during payment verification! Expected ${initialStock - 3}, got ${stockAfterPayment!.stock}`);
    }
  });

  // Cleanup test products
  await prisma.product.deleteMany({
    where: { id: { in: [testProduct1.id, testProduct2.id] } },
  }).catch(() => {});

  console.log('\n==================================================');
  console.log(`PHASE 6D TEST RESULTS: ${results.filter(r => r.passed).length} / ${results.length} PASSED`);
  console.log('==================================================\n');

  if (results.some(r => !r.passed)) {
    console.error('Some tests failed!');
    process.exit(1);
  } else {
    console.log('All 30 Phase 6D tests PASSED perfectly!');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
