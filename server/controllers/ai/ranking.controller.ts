import { Request, Response, NextFunction } from 'express';
import { productRankingService } from '../../services/ai/product-ranking.service';
import { AppError } from '../../errors/app.error';

export class RankingController {
  async rankCandidates(req: Request, res: Response, next: NextFunction) {
    try {
      const { intent, products } = req.body;

      if (!intent || typeof intent !== 'object') {
        throw new AppError('intent is required and must be an object', 400);
      }

      if (!Array.isArray(products)) {
        throw new AppError('products is required and must be an array', 400);
      }

      // Check that array elements are objects with at least id and name
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        if (!p || typeof p !== 'object' || !p.id || typeof p.id !== 'string') {
          throw new AppError(`products[${i}] must be an object containing a valid id`, 400);
        }
      }

      const result = await productRankingService.rankCandidates(intent, products);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const rankingController = new RankingController();
