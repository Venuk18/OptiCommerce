import { OrderStatus, AttributionSource } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';
import { eventService } from './event.service';
import { attributionService } from './revenue/attribution.service';
import {
  CheckoutInput,
  OrderResponseData,
  OrderItemResponse,
  OrderConfirmationInput,
} from '../types/order.types';

const MAX_SESSION_ID_LENGTH = 128;

// Active in-memory checkout mutex lock to prevent concurrent double-click submissions
const activeCheckoutLocks = new Set<string>();

export class OrderService {
  /**
   * Helper to format an Order record with its items into customer-safe OrderResponseData
   * STRICTLY strips any merchant cost/margin metrics.
   */
  private formatOrder(order: any): OrderResponseData {
    const items: OrderItemResponse[] = (order.items || []).map((item: any) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      discountPercent: Number(item.discountPercent || 0),
      discountAmount: Number(item.discountAmount || 0),
      lineTotal: Number(item.lineTotal),
    }));

    return {
      orderId: order.id,
      sessionId: order.sessionId,
      storeId: order.storeId,
      customerId: order.customerId || null,
      status: order.status as OrderStatus,
      paymentStatus: (order.paymentStatus || 'CREATED') as any,
      razorpayOrderId: order.razorpayOrderId || null,
      razorpayPaymentId: order.razorpayPaymentId || null,
      currency: order.currency || 'INR',
      subtotal: Number(order.subtotal),
      discount: Number(order.discount || 0),
      total: Number(order.total),
      createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt),
      items,
    };
  }

  /**
   * POST /api/orders/checkout
   * Converts customer cart into a persistent server-authoritative Order snapshot.
   * STRICT ZERO GEMINI CALLS.
   */
  async checkout(input: CheckoutInput): Promise<OrderResponseData> {
    if (!input || typeof input !== 'object') {
      throw new AppError('Request body is required', 400);
    }

    const { sessionId, storeId, customerId } = input;

    // 1. Validate sessionId
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new AppError('sessionId is required and must be a non-empty string', 400);
    }
    const cleanSessionId = sessionId.trim();
    if (cleanSessionId.length > MAX_SESSION_ID_LENGTH) {
      throw new AppError(`sessionId exceeds maximum length of ${MAX_SESSION_ID_LENGTH} characters`, 400);
    }

    // 2. Validate storeId
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required and must be a non-empty string', 400);
    }
    const cleanStoreId = storeId.trim();

    // 3. Double-Checkout Lock Protection
    const lockKey = `${cleanSessionId}:${cleanStoreId}`;
    if (activeCheckoutLocks.has(lockKey)) {
      throw new AppError('A checkout is currently in progress for this cart. Please wait.', 409);
    }

    activeCheckoutLocks.add(lockKey);

    try {
      // 4. Verify store exists
      const store = await prisma.store.findUnique({
        where: { id: cleanStoreId },
      });
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Track CHECKOUT_STARTED event (non-blocking)
      eventService
        .createEvent({
          sessionId: cleanSessionId,
          storeId: cleanStoreId,
          eventType: 'CHECKOUT_STARTED',
          metadata: {
            source: 'checkout_api',
          },
        })
        .catch(() => {});

      // 5. Find and validate customer cart
      const cart = await prisma.cart.findUnique({
        where: {
          sessionId_storeId: {
            sessionId: cleanSessionId,
            storeId: cleanStoreId,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new AppError('Cart is empty. Please add items before checking out.', 400);
      }

      // 6. Verify products and validate inventory & discounts
      const checkoutTime = new Date();
      const preparedItems: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        discountPercent: number;
        discountAmount: number;
        lineSubtotal: number;
        lineTotal: number;
        attributionSource: AttributionSource;
      }> = [];

      for (const cartItem of cart.items) {
        const product = cartItem.product;

        if (!product) {
          throw new AppError('One of the products in your cart could not be found', 400);
        }

        // Store isolation check
        if (product.storeId !== cleanStoreId) {
          throw new AppError(
            `Product '${product.name}' does not belong to the requested store`,
            400
          );
        }

        // Purchasability status check
        if (product.status === 'OUT_OF_STOCK' || product.stock <= 0) {
          throw new AppError(
            `Product '${product.name}' is currently out of stock and cannot be purchased`,
            400
          );
        }

        if (product.status === 'DRAFT' || product.status === 'ARCHIVED') {
          throw new AppError(
            `Product '${product.name}' is no longer available for purchase`,
            400
          );
        }

        // Inventory sufficiency check
        if (cartItem.quantity > product.stock) {
          throw new AppError(
            `Insufficient stock for '${product.name}'. Requested: ${cartItem.quantity}, Available: ${product.stock}`,
            400
          );
        }

        // Server-authoritative unit price directly from PostgreSQL
        const unitPrice = Number(product.price);
        if (isNaN(unitPrice) || unitPrice <= 0) {
          throw new AppError(`Invalid product price for '${product.name}'`, 400);
        }

        const lineSubtotal = Number((unitPrice * cartItem.quantity).toFixed(2));

        // 7. Discount / Offer Validation
        // Check for any validated accepted offer for this product and session
        let validatedDiscountPercent = 0;
        try {
          const acceptedOfferEvent = await prisma.commerceEvent.findFirst({
            where: {
              sessionId: cleanSessionId,
              storeId: cleanStoreId,
              productId: product.id,
              eventType: 'OFFER_ACCEPTED',
              createdAt: {
                lte: checkoutTime,
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (acceptedOfferEvent && acceptedOfferEvent.metadata && typeof acceptedOfferEvent.metadata === 'object') {
            const meta = acceptedOfferEvent.metadata as Record<string, any>;
            const rawDiscount = Number(meta.discountPercent ?? meta.discount ?? 0);
            if (!isNaN(rawDiscount) && rawDiscount > 0 && rawDiscount <= 100) {
              // Ensure margin safety: discounted price >= costPrice
              const costPrice = Number(product.costPrice || 0);
              const discountedPrice = unitPrice * (1 - rawDiscount / 100);
              if (discountedPrice >= costPrice) {
                validatedDiscountPercent = Math.min(100, Math.max(0, rawDiscount));
              }
            }
          }
        } catch {
          // Non-blocking discount fallback
          validatedDiscountPercent = 0;
        }

        const lineDiscount = Number(
          (lineSubtotal * (validatedDiscountPercent / 100)).toFixed(2)
        );
        const lineTotal = Number(
          Math.max(0, lineSubtotal - lineDiscount).toFixed(2)
        );

        // 8. Server-Authoritative Attribution Resolution
        // Strict priority hierarchy: RECOVERY > OFFER > BUNDLE > AI_CHAT > DIRECT
        let attributionSource: AttributionSource = AttributionSource.DIRECT;
        try {
          attributionSource = await attributionService.resolveAttributionSource({
            sessionId: cleanSessionId,
            storeId: cleanStoreId,
            productId: product.id,
            checkoutTime,
          });
        } catch {
          attributionSource = AttributionSource.DIRECT;
        }

        preparedItems.push({
          productId: product.id,
          productName: product.name,
          quantity: cartItem.quantity,
          unitPrice,
          discountPercent: validatedDiscountPercent,
          discountAmount: lineDiscount,
          lineSubtotal,
          lineTotal,
          attributionSource,
        });
      }

      // Calculate Order Totals
      const subtotal = Number(
        preparedItems.reduce((sum, it) => sum + it.lineSubtotal, 0).toFixed(2)
      );
      const discount = Number(
        preparedItems.reduce((sum, it) => sum + it.discountAmount, 0).toFixed(2)
      );
      const total = Number(Math.max(0, subtotal - discount).toFixed(2));

      // 8. Execute Database Transaction for Atomic Order Creation & Inventory Decrement
      const createdOrder = await prisma.$transaction(async (tx) => {
        // Step A: Decrement inventory with conditional check preventing overselling
        for (const item of preparedItems) {
          const updateResult = await tx.product.updateMany({
            where: {
              id: item.productId,
              stock: { gte: item.quantity },
            },
            data: {
              stock: { decrement: item.quantity },
            },
          });

          if (updateResult.count === 0) {
            throw new AppError(
              `Failed to reserve inventory for '${item.productName}'. Stock may have changed.`,
              400
            );
          }
        }

        // Step B: Create Order & OrderItem records
        const resolvedCustomerId = customerId || cart.customerId || null;
        const newOrder = await tx.order.create({
          data: {
            sessionId: cleanSessionId,
            storeId: cleanStoreId,
            customerId: resolvedCustomerId,
            status: 'PENDING',
            subtotal,
            discount,
            total,
            currency: 'INR',
            items: {
              create: preparedItems.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountPercent: item.discountPercent,
                discountAmount: item.discountAmount,
                lineTotal: item.lineTotal,
                attributionSource: item.attributionSource,
              })),
            },
          },
          include: {
            items: true,
          },
        });

        // Step C: Clear the purchased cart items
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });

        return newOrder;
      });

      // Track CHECKOUT_STARTED event
      await eventService
        .createEvent({
          sessionId: cleanSessionId,
          storeId: cleanStoreId,
          eventType: 'CHECKOUT_STARTED',
          metadata: {
            source: 'checkout_order_created',
            orderId: createdOrder.id,
            total: Number(createdOrder.total),
            currency: 'INR',
          },
        })
        .catch(() => {});

      return this.formatOrder(createdOrder);
    } finally {
      activeCheckoutLocks.delete(lockKey);
    }
  }

  /**
   * GET /api/orders/:id - Retrieve order details with session ownership enforcement
   */
  async getOrder(orderId: string, sessionId: string, storeId: string): Promise<OrderResponseData> {
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      throw new AppError('orderId is required', 400);
    }
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId.trim() },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Session and Store isolation check
    if (order.sessionId !== sessionId.trim() || order.storeId !== storeId.trim()) {
      throw new AppError('Order not found or access denied', 404);
    }

    return this.formatOrder(order);
  }

  /**
   * GET /api/orders - List orders for the active session and store
   */
  async listOrders(sessionId: string, storeId: string): Promise<OrderResponseData[]> {
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const orders = await prisma.order.findMany({
      where: {
        sessionId: sessionId.trim(),
        storeId: storeId.trim(),
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders.map((o) => this.formatOrder(o));
  }

  /**
   * PATCH /api/orders/:id/confirm - Order confirmation foundation (internal state update)
   */
  async confirmOrder(
    orderId: string,
    input: OrderConfirmationInput
  ): Promise<OrderResponseData> {
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      throw new AppError('orderId is required', 400);
    }
    if (!input || typeof input !== 'object') {
      throw new AppError('Request body is required', 400);
    }

    const { sessionId, storeId } = input;
    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId.trim() },
    });

    if (!existingOrder) {
      throw new AppError('Order not found', 404);
    }

    if (existingOrder.sessionId !== sessionId.trim() || existingOrder.storeId !== storeId.trim()) {
      throw new AppError('Order not found or access denied', 404);
    }

    if (existingOrder.status === 'CANCELLED') {
      throw new AppError('Cancelled orders cannot be confirmed', 400);
    }

    if (existingOrder.status === 'CONFIRMED') {
      return this.formatOrder(existingOrder);
    }

    const updated = await prisma.order.update({
      where: { id: existingOrder.id },
      data: {
        status: 'CONFIRMED',
        paymentStatus: existingOrder.paymentStatus === 'FAILED' ? 'FAILED' : 'PAID',
      },
      include: {
        items: true,
      },
    });

    // Track PURCHASE event on order confirmation
    await eventService
      .createEvent({
        sessionId: sessionId.trim(),
        storeId: storeId.trim(),
        eventType: 'PURCHASE',
        metadata: {
          source: 'order_confirmation',
          orderId: updated.id,
          total: Number(updated.total),
          currency: 'INR',
        },
      })
      .catch(() => {});

    return this.formatOrder(updated);
  }
}

export const orderService = new OrderService();
