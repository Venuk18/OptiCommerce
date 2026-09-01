import { Request, Response, NextFunction } from 'express';
import { cartService } from '../services/cart.service';
import { bundleService } from '../services/bundle.service';

export class CartController {
  async getBundleSuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, storeId, productId, limit } = req.body;

      const result = await bundleService.getBundleSuggestions({
        sessionId: sessionId || (req.headers['x-session-id'] as string) || '',
        storeId,
        productId,
        limit: limit !== undefined ? Number(limit) : 3,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string) || '';
      const storeId = (req.query.storeId as string) || '';

      const cart = await cartService.getCart(sessionId, storeId);

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, storeId, productId, quantity } = req.body;

      const cart = await cartService.addItem({
        sessionId: sessionId || (req.headers['x-session-id'] as string) || '',
        storeId,
        productId,
        quantity: quantity !== undefined ? Number(quantity) : 1,
      });

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const { sessionId, storeId, quantity } = req.body;

      const cart = await cartService.updateItemQuantity(itemId, {
        sessionId: sessionId || (req.headers['x-session-id'] as string) || '',
        storeId,
        quantity: Number(quantity),
      });

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const sessionId = (req.query.sessionId as string) || req.body?.sessionId || (req.headers['x-session-id'] as string) || '';
      const storeId = (req.query.storeId as string) || req.body?.storeId || '';

      const cart = await cartService.removeItem(itemId, sessionId, storeId);

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async clearCart(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = (req.query.sessionId as string) || req.body?.sessionId || (req.headers['x-session-id'] as string) || '';
      const storeId = (req.query.storeId as string) || req.body?.storeId || '';

      const cart = await cartService.clearCart(sessionId, storeId);

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const cartController = new CartController();
