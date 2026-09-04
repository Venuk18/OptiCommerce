import { Request, Response, NextFunction } from 'express';
import { recommendationService } from '../../services/ai/recommendation.service';
import { AppError } from '../../errors/app.error';

export class RecommendationController {
  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const { storeId, query, conversationContext, cartProductIds, focusedProductId, sessionId } = req.body;

      if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
        throw new AppError('storeId is required and must be a non-empty string', 400);
      }

      if (!query || typeof query !== 'string' || !query.trim()) {
        throw new AppError('query is required and must be a non-empty string', 400);
      }

      const result = await recommendationService.getRecommendations(
        storeId.trim(),
        query.trim(),
        {
          conversationContext: conversationContext && typeof conversationContext === 'object' ? conversationContext : undefined,
          cartProductIds: Array.isArray(cartProductIds) ? cartProductIds.filter((id) => typeof id === 'string' && id.trim().length > 0) : undefined,
          focusedProductId: typeof focusedProductId === 'string' && focusedProductId.trim().length > 0 ? focusedProductId.trim() : undefined,
          sessionId: typeof sessionId === 'string' && sessionId.trim().length > 0 ? sessionId.trim() : undefined,
        }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const recommendationController = new RecommendationController();
