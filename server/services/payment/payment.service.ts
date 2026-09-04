import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/app.error';
import { eventService } from '../event.service';
import { RazorpayClient } from './razorpay.client';
import {
  CreatePaymentOrderInput,
  CreatePaymentOrderResponseData,
  VerifyPaymentInput,
  VerifyPaymentResponseData,
  PaymentWebhookEvent,
} from '../../types/payment.types';

export class PaymentService {
  /**
   * POST /api/payments/create-order
   * Resolves order by sessionId & storeId, reads authoritative total from DB,
   * creates a Razorpay order in paise, and saves razorpayOrderId to the Order.
   * STRICT ZERO GEMINI CALLS.
   */
  async createPaymentOrder(input: CreatePaymentOrderInput): Promise<CreatePaymentOrderResponseData> {
    if (!input || typeof input !== 'object') {
      throw new AppError('Request body is required', 400);
    }

    const { orderId, sessionId, storeId } = input;

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      throw new AppError('orderId is required', 400);
    }
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanOrderId = orderId.trim();
    const cleanSessionId = sessionId.trim();
    const cleanStoreId = storeId.trim();

    // 1. Resolve internal Order
    const order = await prisma.order.findUnique({
      where: { id: cleanOrderId },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // 2. Strict Session and Store ownership check
    if (order.sessionId !== cleanSessionId || order.storeId !== cleanStoreId) {
      throw new AppError('Order not found or access denied', 404);
    }

    // 3. Ensure Order status is PENDING
    if (order.status !== 'PENDING') {
      throw new AppError(`Order is already ${order.status} and cannot initiate payment`, 400);
    }

    // 4. Ensure paymentStatus is unpaid (CREATED or FAILED)
    if (order.paymentStatus === 'PAID') {
      throw new AppError('Order has already been paid', 400);
    }

    // 5. Read server-authoritative Order.total from PostgreSQL
    const totalAmount = Number(order.total);
    if (isNaN(totalAmount) || totalAmount < 0) {
      throw new AppError('Invalid order total amount', 400);
    }

    // Convert INR to Razorpay paise (e.g., ₹5,000.00 -> 500000 paise)
    const amountInPaise = Math.round(totalAmount * 100);

    // 6. Create Razorpay order (or reuse existing razorpayOrderId)
    let rzpOrderId = order.razorpayOrderId;
    if (!rzpOrderId) {
      const rzpOrder = await RazorpayClient.createOrder({
        amountInPaise,
        receipt: `rcpt_${cleanOrderId.slice(-12)}`,
        notes: {
          orderId: cleanOrderId,
          storeId: cleanStoreId,
          sessionId: cleanSessionId,
        },
      });
      rzpOrderId = rzpOrder.id;

      // 7. Persist razorpayOrderId in the Order record
      await prisma.order.update({
        where: { id: cleanOrderId },
        data: {
          razorpayOrderId: rzpOrderId,
        },
      });
    }

    // 8. Track CHECKOUT_STARTED event (non-blocking if error)
    await eventService
      .createEvent({
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        eventType: 'CHECKOUT_STARTED',
        metadata: {
          source: 'create_payment_order',
          orderId: cleanOrderId,
          amount: amountInPaise,
          razorpayOrderId: rzpOrderId,
          currency: 'INR',
        },
      })
      .catch(() => {});

    // 9. Return strictly customer-safe payment payload
    return {
      razorpayOrderId: rzpOrderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: RazorpayClient.getPublicKeyId(),
    };
  }

  /**
   * POST /api/payments/verify
   * Verifies Razorpay payment signature server-side.
   * On success: transitions paymentStatus -> PAID and order status -> CONFIRMED.
   * Idempotent & secure.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResponseData> {
    if (!input || typeof input !== 'object') {
      throw new AppError('Request body is required', 400);
    }

    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      sessionId,
      storeId,
    } = input;

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      throw new AppError('orderId is required', 400);
    }
    if (!razorpayOrderId || typeof razorpayOrderId !== 'string' || !razorpayOrderId.trim()) {
      throw new AppError('razorpayOrderId is required', 400);
    }
    if (!razorpayPaymentId || typeof razorpayPaymentId !== 'string' || !razorpayPaymentId.trim()) {
      throw new AppError('razorpayPaymentId is required', 400);
    }
    if (!razorpaySignature || typeof razorpaySignature !== 'string' || !razorpaySignature.trim()) {
      throw new AppError('razorpaySignature is required', 400);
    }
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanOrderId = orderId.trim();
    const cleanRzpOrderId = razorpayOrderId.trim();
    const cleanRzpPaymentId = razorpayPaymentId.trim();
    const cleanRzpSignature = razorpaySignature.trim();
    const cleanSessionId = sessionId.trim();
    const cleanStoreId = storeId.trim();

    // 1. Resolve internal Order
    const order = await prisma.order.findUnique({
      where: { id: cleanOrderId },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // 2. Strict Session and Store ownership check
    if (order.sessionId !== cleanSessionId || order.storeId !== cleanStoreId) {
      throw new AppError('Order not found or access denied', 404);
    }

    // 3. Idempotency check: If already paid, return confirmed details immediately
    if (order.paymentStatus === 'PAID') {
      return {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        razorpayPaymentId: order.razorpayPaymentId || cleanRzpPaymentId,
      };
    }

    // 4. Verify Razorpay Order ID matches what was persisted
    if (order.razorpayOrderId && order.razorpayOrderId !== cleanRzpOrderId) {
      throw new AppError('Razorpay order ID mismatch', 400);
    }

    // 5. Server-side HMAC-SHA256 signature verification
    const isValidSignature = RazorpayClient.verifyPaymentSignature({
      razorpayOrderId: cleanRzpOrderId,
      razorpayPaymentId: cleanRzpPaymentId,
      razorpaySignature: cleanRzpSignature,
    });

    if (!isValidSignature) {
      // Record payment failure state without confirming order
      await prisma.order.update({
        where: { id: cleanOrderId },
        data: {
          paymentStatus: 'FAILED',
        },
      });
      throw new AppError('Invalid payment signature', 400);
    }

    // 6. Transition state atomically to PAID & CONFIRMED
    const updatedOrder = await prisma.order.update({
      where: { id: cleanOrderId },
      data: {
        paymentStatus: 'PAID',
        razorpayPaymentId: cleanRzpPaymentId,
        razorpayOrderId: cleanRzpOrderId,
        status: 'CONFIRMED',
      },
    });

    // 7. Track confirmed PURCHASE event (non-blocking)
    await eventService
      .createEvent({
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        eventType: 'PURCHASE',
        metadata: {
          source: 'payment_verification',
          orderId: updatedOrder.id,
          total: Number(updatedOrder.total),
          razorpayPaymentId: cleanRzpPaymentId,
          currency: 'INR',
        },
      })
      .catch(() => {});

    return {
      orderId: updatedOrder.id,
      status: updatedOrder.status,
      paymentStatus: updatedOrder.paymentStatus,
      razorpayPaymentId: cleanRzpPaymentId,
    };
  }

  /**
   * POST /api/payments/webhook
   * Processes incoming Razorpay webhooks securely with signature validation.
   */
  async handleWebhook(
    rawBody: string,
    signature: string,
    eventData: PaymentWebhookEvent
  ): Promise<{ received: boolean; processed: boolean; status?: string }> {
    if (!signature) {
      throw new AppError('Webhook signature header missing', 400);
    }

    // 1. Verify Webhook Signature
    const isValid = RazorpayClient.verifyWebhookSignature({
      rawBody,
      signature,
    });

    if (!isValid) {
      throw new AppError('Invalid webhook signature', 400);
    }

    if (!eventData || !eventData.event) {
      return { received: true, processed: false, status: 'ignored_empty_payload' };
    }

    const eventName = eventData.event;

    // Handle payment.captured or order.paid
    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const paymentEntity = eventData.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id || eventData.payload?.order?.entity?.id;
      const rzpPaymentId = paymentEntity?.id;

      if (!rzpOrderId) {
        return { received: true, processed: false, status: 'no_rzp_order_id' };
      }

      // Map to internal order by razorpayOrderId
      const order = await prisma.order.findUnique({
        where: { razorpayOrderId: rzpOrderId },
      });

      if (!order) {
        return { received: true, processed: false, status: 'order_not_found' };
      }

      // Idempotent: if already paid, skip duplicate transition
      if (order.paymentStatus === 'PAID') {
        return { received: true, processed: true, status: 'already_paid' };
      }

      // Confirm order and mark as PAID
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          razorpayPaymentId: rzpPaymentId || order.razorpayPaymentId,
          status: 'CONFIRMED',
        },
      });

      // Track confirmed PURCHASE event (non-blocking)
      eventService
        .createEvent({
          sessionId: order.sessionId,
          storeId: order.storeId,
          eventType: 'PURCHASE',
          metadata: {
            source: 'razorpay_webhook',
            orderId: order.id,
            total: Number(order.total),
            razorpayPaymentId: rzpPaymentId,
            currency: 'INR',
          },
        })
        .catch(() => {});

      return { received: true, processed: true, status: 'order_confirmed_via_webhook' };
    }

    // Handle payment.failed
    if (eventName === 'payment.failed') {
      const paymentEntity = eventData.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;

      if (rzpOrderId) {
        const order = await prisma.order.findUnique({
          where: { razorpayOrderId: rzpOrderId },
        });

        if (order && order.paymentStatus !== 'PAID') {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'FAILED',
            },
          });
        }
      }
      return { received: true, processed: true, status: 'payment_failure_logged' };
    }

    return { received: true, processed: false, status: 'unhandled_event_type' };
  }
}

export const paymentService = new PaymentService();
