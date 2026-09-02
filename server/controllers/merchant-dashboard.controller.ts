import { Request, Response, NextFunction } from 'express';
import { merchantDashboardService } from '../services/merchant-dashboard.service';

export class MerchantDashboardController {
  /**
   * GET /api/merchant-dashboard/summary?storeId=<storeId>
   * Returns aggregated read-only revenue and conversion metrics for the merchant dashboard.
   */
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = (req.query.storeId as string) || '';

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
      const storeId = (req.query.storeId as string) || '';

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
      const storeId = (req.query.storeId as string) || '';

      const attribution = await merchantDashboardService.getAttributionSummary(storeId);

      res.status(200).json({
        success: true,
        data: attribution,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const merchantDashboardController = new MerchantDashboardController();
