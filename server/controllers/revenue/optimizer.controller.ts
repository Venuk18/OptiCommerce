import { Request, Response, NextFunction } from 'express';
import { revenueOptimizerService } from '../../services/revenue/revenue-optimizer.service';
import {
  OptimizeRevenueRequest,
  CustomerRevenueOptimizationResponse,
} from '../../types/revenue.types';

export class RevenueOptimizerController {
  /**
   * POST /api/revenue/optimize
   * Evaluates candidate discount actions and returns the profit-maximizing recommendation.
   * STRICT ZERO GEMINI CALLS.
   */
  async optimize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as OptimizeRevenueRequest;

      const result = await revenueOptimizerService.optimizeRevenue(payload);

      // Customer-safe response payload (CRITICAL: costPrice, margin, expectedProfit, baselineExpectedProfit, purchaseProbability are strictly omitted)
      const customerData: CustomerRevenueOptimizationResponse = {
        productId: result.productId,
        price: result.price,
        recommendedDiscount: result.recommendedDiscount,
        recommendedPrice: result.recommendedPrice,
        reason: result.reason,
      };

      res.status(200).json({
        success: true,
        data: customerData,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const revenueOptimizerController = new RevenueOptimizerController();
