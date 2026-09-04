import { Request, Response, NextFunction } from 'express';
import { comparisonService } from '../../services/ai/comparison.service';
import { AppError } from '../../errors/app.error';

export class ComparisonController {
  async compareProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { storeId, productIds, conversationState, query } = req.body;

      if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
        throw new AppError('storeId is required and must be a non-empty string', 400);
      }

      if (!productIds || !Array.isArray(productIds)) {
        throw new AppError('productIds array is required', 400);
      }

      if (productIds.length < 2) {
        throw new AppError('At least 2 products are required for comparison', 400);
      }

      if (productIds.length > 3) {
        throw new AppError('Comparison is limited to 2 or 3 products', 400);
      }

      const result = await comparisonService.compareProducts({
        storeId: storeId.trim(),
        productIds: productIds.map((id) => String(id).trim()),
        conversationState: conversationState && typeof conversationState === 'object' ? conversationState : undefined,
        query: typeof query === 'string' ? query.trim() : undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const comparisonController = new ComparisonController();
