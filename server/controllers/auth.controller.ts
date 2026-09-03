import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AppError } from '../errors/app.error';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password, storeName } = req.body;
      const result = await authService.register({ name, email, password, storeName });
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.merchant || !req.merchant.id) {
        throw new AppError('Unauthorized: Identity not attached', 401);
      }
      const merchant = await authService.getCurrentMerchant(req.merchant.id);
      res.status(200).json({
        success: true,
        data: merchant,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
