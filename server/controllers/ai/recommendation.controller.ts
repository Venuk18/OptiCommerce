import { Request, Response, NextFunction } from 'express';
import { recommendationService } from '../../services/ai/recommendation.service';
import { AppError } from '../../errors/app.error';

export class RecommendationController {
  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const { storeId, query } = req.body;

      if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
        throw new AppError('storeId is required and must be a non-empty string', 400);
      }

      if (!query || typeof query !== 'string' || !query.trim()) {
        throw new AppError('query is required and must be a non-empty string', 400);
      }

      const result = await recommendationService.getRecommendations(storeId.trim(), query.trim());

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
