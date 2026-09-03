import { Request, Response, NextFunction } from 'express';
import { merchantService } from '../services/merchant.service';
import { AppError } from '../errors/app.error';

export class MerchantController {
  async createMerchant(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password } = req.body;
      const merchant = await merchantService.createMerchant({ name, email, password });
      res.status(201).json({
        success: true,
        data: merchant,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMerchantById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        throw new AppError('Merchant ID is required', 400);
      }

      if (!req.merchant || req.merchant.id !== id.trim()) {
        throw new AppError('Forbidden: You can only access your own merchant profile', 403);
      }

      const merchant = await merchantService.getMerchantById(id.trim());
      res.status(200).json({
        success: true,
        data: merchant,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const merchantController = new MerchantController();

