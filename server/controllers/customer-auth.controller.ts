import { Request, Response, NextFunction } from 'express';
import { customerAuthService } from '../services/customer-auth.service';
import { AppError } from '../errors/app.error';

export class CustomerAuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { storeId, email, password, name } = req.body;
      const result = await customerAuthService.register({ storeId, email, password, name });
      res.status(201).json({
        success: true,
        customer: result.customer,
        token: result.token,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { storeId, email, password } = req.body;
      const result = await customerAuthService.login({ storeId, email, password });
      res.status(200).json({
        success: true,
        customer: result.customer,
        token: result.token,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.customer || !req.customer.customerId || !req.customer.storeId) {
        throw new AppError('Unauthorized: Customer identity not attached', 401);
      }

      // Authoritative token storeId: ignore any query or body storeId overrides
      const customer = await customerAuthService.getCurrentCustomer(
        req.customer.customerId,
        req.customer.storeId
      );

      res.status(200).json({
        success: true,
        customer,
        data: {
          customer,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const customerAuthController = new CustomerAuthController();
