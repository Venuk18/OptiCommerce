import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';
import {
  MerchantDashboardSummaryData,
  MerchantFunnelSummaryData,
  MerchantAttributionSummaryData,
  MerchantOrderData,
  MerchantOrdersData,
} from '../types/merchant-dashboard.types';
import { AttributionSource } from '@prisma/client';

export class MerchantDashboardService {
  /**
   * Calculates merchant dashboard revenue and conversion metrics for a given store.
   *
   * STRICT GUARANTEES:
   * - Read-only analytics (no database mutations).
   * - ZERO Gemini / AI API calls.
   * - Complete store isolation (never mixes data between stores).
   * - Genuine paid revenue accounting (only CONFIRMED + PAID orders).
   * - Strips any internal merchant cost/margin metrics and customer PII.
   */
  async getSummary(storeId: string): Promise<MerchantDashboardSummaryData> {
    // 1. Validation
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanStoreId = storeId.trim();

    // 2. Verify Store exists
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // 3. Query genuinely completed/paid orders for this store
    // Filter strictly by storeId, status = CONFIRMED, and paymentStatus = PAID.
    // Excludes PENDING, CANCELLED, FAILED, or CREATED (unpaid) orders.
    const paidOrders = await prisma.order.findMany({
      where: {
        storeId: cleanStoreId,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      },
      select: {
        id: true,
        total: true,
      },
    });

    const totalOrders = paidOrders.length;
    const rawRevenue = paidOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const totalRevenue = Number(rawRevenue.toFixed(2));

    // 4. Calculate Average Order Value (AOV)
    const averageOrderValue =
      totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

    // 5. Calculate Offer Acceptance Rate from CommerceEvent records
    // Offered: OFFER_VIEW
    // Accepted: OFFER_ACCEPTED
    const [offerViewsCount, offerAcceptedCount] = await Promise.all([
      prisma.commerceEvent.count({
        where: {
          storeId: cleanStoreId,
          eventType: 'OFFER_VIEW',
        },
      }),
      prisma.commerceEvent.count({
        where: {
          storeId: cleanStoreId,
          eventType: 'OFFER_ACCEPTED',
        },
      }),
    ]);

    const offerAcceptanceRate =
      offerViewsCount > 0
        ? Number(((offerAcceptedCount / offerViewsCount) * 100).toFixed(2))
        : 0;

    // 6. Calculate Recovered Sales & Bundle Revenue (Attribution-Safe)
    // Inspect existing PURCHASE events for this store.
    // If no explicit attribution metadata is present in stored records, return 0 (no fabrication).
    let recoveredSales = 0;
    let bundleRevenue = 0;

    try {
      const purchaseEvents = await prisma.commerceEvent.findMany({
        where: {
          storeId: cleanStoreId,
          eventType: 'PURCHASE',
        },
        select: {
          metadata: true,
        },
      });

      for (const evt of purchaseEvents) {
        if (!evt.metadata || typeof evt.metadata !== 'object') continue;
        const meta = evt.metadata as Record<string, any>;
        const source = meta.source ? String(meta.source).toLowerCase() : '';
        const rawAmount = typeof meta.total === 'number' ? meta.total : typeof meta.amount === 'number' ? meta.amount : 0;
        const amount = typeof rawAmount === 'number' && !isNaN(rawAmount) && rawAmount > 0 ? rawAmount : 0;

        if (source === 'sale_recovery' || source === 'recovery') {
          recoveredSales += amount;
        } else if (source === 'bundle' || source === 'bundle_cross_sell') {
          bundleRevenue += amount;
        }
      }
    } catch {
      recoveredSales = 0;
      bundleRevenue = 0;
    }

    recoveredSales = Number(recoveredSales.toFixed(2));
    bundleRevenue = Number(bundleRevenue.toFixed(2));

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      offerAcceptanceRate,
      recoveredSales,
      bundleRevenue,
    };
  }

  /**
   * Calculates merchant funnel analytics for a given store from CommerceEvent records.
   *
   * STRICT GUARANTEES:
   * - Read-only analytics (no database mutations).
   * - ZERO Gemini / AI API calls.
   * - Complete store isolation (strictly scoped by storeId).
   * - Computes 12 deterministic event-based funnel metrics:
   *     1. recommendationViews (integer count)
   *     2. recommendationClicks (integer count)
   *     3. recommendationClickRate (2 decimals, 0 if views = 0)
   *     4. productViews (integer count)
   *     5. addToCartEvents (integer count)
   *     6. addToCartRate (2 decimals, 0 if views = 0)
   *     7. checkoutStarted (integer count)
   *     8. purchases (integer count, verified purchase lifecycle)
   *     9. checkoutConversionRate (2 decimals, 0 if checkoutStarted = 0)
   *     10. offerViews (integer count)
   *     11. offerAccepted (integer count)
   *     12. offerAcceptanceRate (2 decimals, 0 if offerViews = 0)
   * - Strips any internal merchant cost/margin metrics and customer PII.
   */
  async getFunnel(storeId: string): Promise<MerchantFunnelSummaryData> {
    // 1. Validation
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanStoreId = storeId.trim();

    // 2. Verify Store exists
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // 3. Aggregate all commerce events for this store
    const eventGroups = await prisma.commerceEvent.groupBy({
      by: ['eventType'],
      where: {
        storeId: cleanStoreId,
      },
      _count: {
        _all: true,
      },
    });

    const eventCounts: Record<string, number> = {
      RECOMMENDATION_VIEW: 0,
      RECOMMENDATION_CLICK: 0,
      PRODUCT_VIEW: 0,
      ADD_TO_CART: 0,
      CHECKOUT_STARTED: 0,
      OFFER_VIEW: 0,
      OFFER_ACCEPTED: 0,
      PURCHASE: 0,
    };

    for (const group of eventGroups) {
      eventCounts[group.eventType] = group._count._all;
    }

    // Recommendation metrics
    const recommendationViews = eventCounts.RECOMMENDATION_VIEW || 0;
    const recommendationClicks = eventCounts.RECOMMENDATION_CLICK || 0;
    const recommendationClickRate =
      recommendationViews > 0
        ? Number(((recommendationClicks / recommendationViews) * 100).toFixed(2))
        : 0;

    // Product & Cart metrics
    const productViews = eventCounts.PRODUCT_VIEW || 0;
    const addToCartEvents = eventCounts.ADD_TO_CART || 0;
    const addToCartRate =
      productViews > 0
        ? Number(((addToCartEvents / productViews) * 100).toFixed(2))
        : 0;

    // Checkout metrics
    const checkoutStarted = eventCounts.CHECKOUT_STARTED || 0;

    // Purchase metrics (verified purchase lifecycle preservation)
    let purchases = eventCounts.PURCHASE || 0;
    if (purchases > 0) {
      const purchaseEvents = await prisma.commerceEvent.findMany({
        where: {
          storeId: cleanStoreId,
          eventType: 'PURCHASE',
        },
        select: {
          metadata: true,
        },
      });

      let validPurchases = 0;
      for (const evt of purchaseEvents) {
        if (evt.metadata && typeof evt.metadata === 'object') {
          const meta = evt.metadata as Record<string, any>;
          if (
            meta.verified === false ||
            meta.status === 'FAILED' ||
            meta.status === 'failed' ||
            meta.paymentStatus === 'FAILED'
          ) {
            continue;
          }
        }
        validPurchases++;
      }
      purchases = validPurchases;
    }

    const checkoutConversionRate =
      checkoutStarted > 0
        ? Number(((purchases / checkoutStarted) * 100).toFixed(2))
        : 0;

    // Offer metrics
    const offerViews = eventCounts.OFFER_VIEW || 0;
    const offerAccepted = eventCounts.OFFER_ACCEPTED || 0;
    const offerAcceptanceRate =
      offerViews > 0
        ? Number(((offerAccepted / offerViews) * 100).toFixed(2))
        : 0;

    return {
      recommendationViews,
      recommendationClicks,
      recommendationClickRate,
      productViews,
      addToCartEvents,
      addToCartRate,
      checkoutStarted,
      purchases,
      checkoutConversionRate,
      offerViews,
      offerAccepted,
      offerAcceptanceRate,
    };
  }

  /**
   * Calculates merchant attribution summary metrics for a given store.
   *
   * STRICT GUARANTEES:
   * - Read-only analytics (no database mutations).
   * - ZERO Gemini / AI API calls.
   * - Complete store isolation (never mixes data between stores).
   * - Genuine paid revenue accounting (only CONFIRMED + PAID orders).
   * - Revenue computed strictly from OrderItem.lineTotal grouped by attributionSource.
   * - Zero double counting: DIRECT + AI_CHAT + BUNDLE + OFFER + RECOVERY === totalAttributedRevenue.
   * - Strips any internal merchant cost/margin metrics and customer PII.
   */
  async getAttributionSummary(storeId: string): Promise<MerchantAttributionSummaryData> {
    // 1. Validation
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanStoreId = storeId.trim();

    // 2. Verify Store exists
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // 3. Query all OrderItems from genuinely completed/paid orders for this store
    const paidOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          storeId: cleanStoreId,
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
        },
      },
      select: {
        lineTotal: true,
        attributionSource: true,
      },
    });

    // 4. Initialize revenue breakdown accumulators
    const revenueBySource: Record<AttributionSource, number> = {
      DIRECT: 0,
      AI_CHAT: 0,
      BUNDLE: 0,
      OFFER: 0,
      RECOVERY: 0,
    };

    for (const item of paidOrderItems) {
      const lineTotal = Number(item.lineTotal) || 0;
      const src = item.attributionSource || AttributionSource.DIRECT;
      if (revenueBySource[src] !== undefined) {
        revenueBySource[src] += lineTotal;
      } else {
        revenueBySource.DIRECT += lineTotal;
      }
    }

    // 5. Compute formatted revenue totals
    const directRevenue = Number(revenueBySource.DIRECT.toFixed(2));
    const aiChatRevenue = Number(revenueBySource.AI_CHAT.toFixed(2));
    const bundleRevenue = Number(revenueBySource.BUNDLE.toFixed(2));
    const offerRevenue = Number(revenueBySource.OFFER.toFixed(2));
    const recoveredRevenue = Number(revenueBySource.RECOVERY.toFixed(2));

    const aiInfluencedRevenue = Number(
      (aiChatRevenue + bundleRevenue + offerRevenue + recoveredRevenue).toFixed(2)
    );

    const totalAttributedRevenue = Number(
      (directRevenue + aiInfluencedRevenue).toFixed(2)
    );

    const aiInfluencedShare =
      totalAttributedRevenue > 0
        ? Number(((aiInfluencedRevenue / totalAttributedRevenue) * 100).toFixed(2))
        : 0;

    return {
      totalAttributedRevenue,
      aiInfluencedRevenue,
      aiInfluencedShare,
      offerRevenue,
      recoveredRevenue,
      bundleRevenue,
      directRevenue,
      attributionBreakdown: [
        { source: 'DIRECT', revenue: directRevenue },
        { source: 'AI_CHAT', revenue: aiChatRevenue },
        { source: 'BUNDLE', revenue: bundleRevenue },
        { source: 'OFFER', revenue: offerRevenue },
        { source: 'RECOVERY', revenue: recoveredRevenue },
      ],
    };
  }

  /**
   * Helper to serialize an order safely for merchant consumption.
   * Strips internal costPrice, expectedProfit, purchaseProbability, passwordHash, and customer sessionId.
   */
  private serializeOrder(order: any): MerchantOrderData {
    return {
      id: order.id,
      createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt),
      updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : String(order.updatedAt),
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      total: Number(order.total),
      currency: order.currency || 'INR',
      razorpayOrderId: order.razorpayOrderId || null,
      razorpayPaymentId: order.razorpayPaymentId || null,
      customerName: null,
      customerEmail: null,
      customerPhone: null,
      shippingAddress: null,
      items: (order.items || []).map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName || item.product?.name || 'Product',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountPercent: Number(item.discountPercent || 0),
        discountAmount: Number(item.discountAmount || 0),
        lineTotal: Number(item.lineTotal),
        attributionSource: item.attributionSource || 'DIRECT',
      })),
    };
  }

  /**
   * Retrieves paginated orders for a store with filtering and search.
   *
   * STRICT GUARANTEES:
   * - Scoped strictly to storeId.
   * - ZERO Gemini / AI API calls.
   * - Returns newest orders first.
   * - Excludes sensitive merchant economics and raw customer sessionId.
   */
  async getStoreOrders(params: {
    storeId: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<MerchantOrdersData> {
    const { storeId, status, search, page = 1, limit = 20 } = params;

    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanStoreId = storeId.trim();

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
      select: { id: true },
    });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // Build Prisma where filter
    const whereClause: any = {
      storeId: cleanStoreId,
    };

    // Status filter
    if (status === 'READY_TO_PROCESS') {
      whereClause.status = 'CONFIRMED';
      whereClause.paymentStatus = 'PAID';
    } else if (status === 'PENDING_PAYMENT') {
      whereClause.status = 'PENDING';
      whereClause.paymentStatus = 'CREATED';
    } else if (status === 'CANCELLED') {
      whereClause.status = 'CANCELLED';
    }

    // Search filter (by order ID)
    if (search && search.trim()) {
      whereClause.id = { contains: search.trim() };
    }

    // Pagination calculations
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Concurrently fetch counts for KPI cards and pagination
    const [totalCount, readyCount, pendingCount, cancelledCount, filteredCount, orders] =
      await Promise.all([
        prisma.order.count({ where: { storeId: cleanStoreId } }),
        prisma.order.count({
          where: { storeId: cleanStoreId, status: 'CONFIRMED', paymentStatus: 'PAID' },
        }),
        prisma.order.count({
          where: { storeId: cleanStoreId, status: 'PENDING', paymentStatus: 'CREATED' },
        }),
        prisma.order.count({ where: { storeId: cleanStoreId, status: 'CANCELLED' } }),
        prisma.order.count({ where: whereClause }),
        prisma.order.findMany({
          where: whereClause,
          include: {
            items: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
      ]);

    return {
      orders: orders.map((order) => this.serializeOrder(order)),
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalOrders: filteredCount,
        totalPages: Math.ceil(filteredCount / limitNum) || 1,
      },
      counts: {
        all: totalCount,
        readyToProcess: readyCount,
        pendingPayment: pendingCount,
        cancelled: cancelledCount,
      },
    };
  }

  /**
   * Retrieves single order detail verified against store ownership.
   */
  async getStoreOrderById(orderId: string, merchantId: string): Promise<MerchantOrderData> {
    if (!orderId || !orderId.trim()) {
      throw new AppError('orderId is required', 400);
    }

    const cleanOrderId = orderId.trim();
    const order = await prisma.order.findUnique({
      where: { id: cleanOrderId },
      include: {
        items: true,
        store: {
          select: { id: true, merchantId: true },
        },
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    let store = order.store;
    if (!store && order.storeId) {
      store = await prisma.store.findUnique({
        where: { id: order.storeId },
        select: { id: true, merchantId: true },
      });
    }

    if (!store || store.merchantId !== merchantId) {
      throw new AppError('Forbidden: You do not have permission to access this order', 403);
    }

    return this.serializeOrder(order);
  }

  /**
   * Cancels an order and atomically restores product inventory.
   *
   * STRICT SAFETY GUARANTEES:
   * - Enforces merchant store ownership.
   * - Rejects already cancelled orders.
   * - Does NOT alter paymentStatus (payment state remains untouched).
   * - Does NOT alter Razorpay transaction IDs.
   * - Transactionally restores stock for each ordered item.
   */
  async cancelStoreOrder(orderId: string, merchantId: string): Promise<MerchantOrderData> {
    if (!orderId || !orderId.trim()) {
      throw new AppError('orderId is required', 400);
    }

    const cleanOrderId = orderId.trim();

    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: cleanOrderId },
        include: {
          items: true,
          store: {
            select: { id: true, merchantId: true },
          },
        },
      });

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      let store = order.store;
      if (!store && order.storeId) {
        store = await tx.store.findUnique({
          where: { id: order.storeId },
          select: { id: true, merchantId: true },
        });
      }

      if (!store || store.merchantId !== merchantId) {
        throw new AppError('Forbidden: You do not have permission to cancel this order', 403);
      }

      if (order.status === 'CANCELLED') {
        throw new AppError('Order is already cancelled', 400);
      }

      // Restore inventory for each item
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
          },
        });
      }

      // Atomically update order status to CANCELLED without touching paymentStatus or razorpay fields
      const updatedOrder = await tx.order.update({
        where: { id: cleanOrderId },
        data: {
          status: 'CANCELLED',
        },
        include: {
          items: true,
        },
      });

      return this.serializeOrder(updatedOrder);
    });
  }
}

export const merchantDashboardService = new MerchantDashboardService();
