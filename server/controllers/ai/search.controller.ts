import { Request, Response, NextFunction } from 'express';
import { candidateRetrievalService } from '../../services/ai/candidate-retrieval.service';
import { AppError } from '../../errors/app.error';

export class SearchController {
  async searchCandidates(req: Request, res: Response, next: NextFunction) {
    try {
      const { storeId, intent } = req.body;

      if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
        throw new AppError('storeId is required and must be a non-empty string', 400);
      }

      if (!intent || typeof intent !== 'object') {
        throw new AppError('intent is required and must be an object', 400);
      }

      const result = await candidateRetrievalService.retrieveCandidates(storeId, intent);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const searchController = new SearchController();
