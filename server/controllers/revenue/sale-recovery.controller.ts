import { Request, Response, NextFunction } from 'express';
import { saleRecoveryService } from '../../services/revenue/sale-recovery.service';
import { RecoverSaleRequest } from '../../types/revenue.types';

export class SaleRecoveryController {
  /**
   * POST /api/revenue/recover-sale
   * Identifies high-affinity, same-store alternative products when a customer rejects an offer.
   * STRICT ZERO GEMINI CALLS.
   */
  async recoverSale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, storeId, rejectedProductId, userQuery, maxBudget, limit } = req.body;

      const input: RecoverSaleRequest = {
        sessionId,
        storeId,
        rejectedProductId,
        userQuery,
        maxBudget: maxBudget !== undefined && maxBudget !== null ? Number(maxBudget) : undefined,
        limit: limit !== undefined && limit !== null ? Number(limit) : undefined,
      };

      const result = await saleRecoveryService.recoverSale(input);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const saleRecoveryController = new SaleRecoveryController();
