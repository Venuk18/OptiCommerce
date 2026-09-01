import { Request, Response, NextFunction } from 'express';
import { purchaseProbabilityService } from '../../services/revenue/purchase-probability.service';

export class PurchaseProbabilityController {
  async getPurchaseProbability(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, storeId, productId } = req.body;

      const result = await purchaseProbabilityService.estimatePurchaseProbability({
        sessionId,
        storeId,
        productId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const purchaseProbabilityController = new PurchaseProbabilityController();
