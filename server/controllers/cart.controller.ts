import { Request, Response, NextFunction } from 'express';
import { cartService } from '../services/cart.service';
import { bundleService } from '../services/bundle.service';
import { AppError } from '../errors/app.error';

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

  async getCartCrossSell(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, storeId, focusedProductId, query, conversationState, limit, suppressDuplicates } = req.body;

      const result = await bundleService.getCartCrossSell({
        sessionId: sessionId || (req.headers['x-session-id'] as string) || '',
        storeId: storeId || (req.headers['x-store-id'] as string) || '',
        focusedProductId,
        query,
        conversationState,
        limit: limit !== undefined ? Number(limit) : 3,
        suppressDuplicates: Boolean(suppressDuplicates),
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
      const storeId = (req.query.storeId as string) || (req.headers['x-store-id'] as string) || '';
      const customerId = req.customer?.customerId || null;

      const cart = await cartService.getCart(sessionId, storeId, customerId);

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
        cart,
      });
    } catch (error) {
      next(error);
    }
  }

  async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, storeId, productId, quantity } = req.body;
      const customerId = req.customer?.customerId || null;

      const cart = await cartService.addItem({
        sessionId: sessionId || (req.headers['x-session-id'] as string) || '',
        storeId: storeId || (req.headers['x-store-id'] as string) || '',
        productId,
        quantity: quantity !== undefined ? Number(quantity) : 1,
        customerId,
      });

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
        cart,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const { sessionId, storeId, quantity } = req.body;
      const customerId = req.customer?.customerId || null;

      const cart = await cartService.updateItemQuantity(itemId, {
        sessionId: sessionId || (req.headers['x-session-id'] as string) || '',
        storeId: storeId || (req.headers['x-store-id'] as string) || '',
        quantity: Number(quantity),
        customerId,
      });

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
        cart,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const sessionId = (req.query.sessionId as string) || req.body?.sessionId || (req.headers['x-session-id'] as string) || '';
      const storeId = (req.query.storeId as string) || req.body?.storeId || (req.headers['x-store-id'] as string) || '';
      const customerId = req.customer?.customerId || null;

      const cart = await cartService.removeItem(itemId, sessionId, storeId, customerId);

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
        cart,
      });
    } catch (error) {
      next(error);
    }
  }

  async clearCart(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = (req.query.sessionId as string) || req.body?.sessionId || (req.headers['x-session-id'] as string) || '';
      const storeId = (req.query.storeId as string) || req.body?.storeId || (req.headers['x-store-id'] as string) || '';
      const customerId = req.customer?.customerId || null;

      const cart = await cartService.clearCart(sessionId, storeId, customerId);

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
        cart,
      });
    } catch (error) {
      next(error);
    }
  }

  async mergeCart(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.customer || !req.customer.customerId || !req.customer.storeId) {
        throw new AppError('Unauthorized: Customer authentication required', 401);
      }

      const tokenStoreId = req.customer.storeId;
      const requestStoreId = req.body?.storeId || (req.headers['x-store-id'] as string) || '';

      if (requestStoreId && requestStoreId.trim() !== tokenStoreId) {
        throw new AppError('Store mismatch: Customer token is not valid for the requested store', 403);
      }

      const sessionId = req.body?.sessionId || (req.headers['x-session-id'] as string) || '';
      if (!sessionId || !sessionId.trim()) {
        throw new AppError('sessionId is required for cart merge', 400);
      }

      const cart = await cartService.mergeCart({
        customerId: req.customer.customerId,
        storeId: tokenStoreId,
        sessionId: sessionId.trim(),
      });

      res.status(200).json({
        success: true,
        data: {
          cart,
        },
        cart,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const cartController = new CartController();
