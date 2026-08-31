import { Request, Response, NextFunction } from 'express';
import { merchantService } from '../services/merchant.service';

export class MerchantController {
  async createMerchant(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email } = req.body;
      const merchant = await merchantService.createMerchant({ name, email });
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
      const merchant = await merchantService.getMerchantById(id);
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
