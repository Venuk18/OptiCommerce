import { Request, Response, NextFunction } from 'express';
import { merchantDashboardService } from '../services/merchant-dashboard.service';
import { merchantIntelligenceService } from '../services/merchant-intelligence.service';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';

export class MerchantDashboardController {
  /**
   * Helper to validate store existence and enforce store ownership for authenticated merchant
   */
  private async validateStoreAccess(req: Request): Promise<string> {
    const storeId = (req.query.storeId as string) || '';
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanStoreId = storeId.trim();
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
      select: { id: true, merchantId: true },
    });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    if (!req.merchant || store.merchantId !== req.merchant.id) {
      throw new AppError('Forbidden: You do not have permission to access this store', 403);
    }

    return cleanStoreId;
  }

  /**
   * GET /api/merchant-dashboard/summary?storeId=<storeId>
   * Returns aggregated read-only revenue and conversion metrics for the merchant dashboard.
   */
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = await this.validateStoreAccess(req);
      const summary = await merchantDashboardService.getSummary(storeId);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/merchant-dashboard/funnel?storeId=<storeId>
   * Returns aggregated read-only commerce funnel analytics for the merchant dashboard.
   */
  async getFunnel(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = await this.validateStoreAccess(req);
      const funnel = await merchantDashboardService.getFunnel(storeId);

      res.status(200).json({
        success: true,
        data: funnel,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/merchant-dashboard/attribution?storeId=<storeId>
   * Returns aggregated read-only attribution metrics for the merchant dashboard.
   */
  async getAttribution(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = await this.validateStoreAccess(req);
      const attribution = await merchantDashboardService.getAttributionSummary(storeId);

      res.status(200).json({
        success: true,
        data: attribution,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/merchant-dashboard/insights?storeId=<storeId>
   * Returns deterministic revenue intelligence insights and metrics snapshot.
   */
  async getInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = await this.validateStoreAccess(req);
      const insights = await merchantIntelligenceService.generateInsights(storeId);

      res.status(200).json({
        success: true,
        data: insights,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/merchant-dashboard/orders?storeId=<storeId>&status=<status>&search=<search>&page=<page>&limit=<limit>
   * Returns paginated customer orders for the merchant's store with status filters and search.
   */
  async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = await this.validateStoreAccess(req);
      const { status, search, page, limit } = req.query;

      const result = await merchantDashboardService.getStoreOrders({
        storeId,
        status: typeof status === 'string' ? status : undefined,
        search: typeof search === 'string' ? search : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/merchant-dashboard/orders/:orderId
   * Returns complete merchant-visible order details with verified store ownership.
   */
  async getOrderDetail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.merchant) {
        throw new AppError('Unauthorized: Merchant authentication required', 401);
      }
      const { orderId } = req.params;
      if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
        throw new AppError('orderId is required', 400);
      }

      const order = await merchantDashboardService.getStoreOrderById(
        orderId.trim(),
        req.merchant.id
      );

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/merchant-dashboard/orders/:orderId/cancel
   * Cancels an order, restores reserved product inventory, and maintains payment invariant.
   */
  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.merchant) {
        throw new AppError('Unauthorized: Merchant authentication required', 401);
      }
      const { orderId } = req.params;
      if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
        throw new AppError('orderId is required', 400);
      }

      const order = await merchantDashboardService.cancelStoreOrder(
        orderId.trim(),
        req.merchant.id
      );

      res.status(200).json({
        success: true,
        message: 'Order successfully cancelled and inventory restored',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const merchantDashboardController = new MerchantDashboardController();

