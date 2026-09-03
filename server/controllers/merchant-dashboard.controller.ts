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
}

export const merchantDashboardController = new MerchantDashboardController();

