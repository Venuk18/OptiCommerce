import { Request, Response, NextFunction } from 'express';
import { intentExtractorService } from '../../services/ai/intent-extractor.service';
import { AppError } from '../../errors/app.error';

export class IntentController {
  async extractIntent(req: Request, res: Response, next: NextFunction) {
    try {
      const { query } = req.body;

      if (query === undefined || query === null) {
        throw new AppError('Query is required', 400);
      }

      if (typeof query !== 'string') {
        throw new AppError('Query must be a string', 400);
      }

      const trimmedQuery = query.trim();
      if (trimmedQuery.length === 0) {
        throw new AppError('Query cannot be empty', 400);
      }

      if (query.length > 1000) {
        throw new AppError('Query exceeds maximum length of 1000 characters', 400);
      }

      const { intent } = await intentExtractorService.extractIntent(trimmedQuery);

      res.status(200).json({
        success: true,
        data: intent,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const intentController = new IntentController();
