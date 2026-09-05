import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';

export class OrderController {
  /**
   * POST /api/orders/checkout
   * Checkout customer cart to create persistent Order
   */
  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.body?.sessionId || (req.headers['x-session-id'] as string) || '';
      const storeId = req.body?.storeId || '';

      const customerId = req.customer?.customerId || req.body?.customerId || null;

      const order = await orderService.checkout({
        sessionId,
        storeId,
        customerId,
      });

      res.status(201).json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/orders/:id
   * Get single order by ID with session ownership check
   */
  async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string) || '';
      const storeId = (req.query.storeId as string) || '';

      const order = await orderService.getOrder(id, sessionId, storeId);

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/orders
   * List customer orders for active session and store
   */
  async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string) || '';
      const storeId = (req.query.storeId as string) || '';

      const orders = await orderService.listOrders(sessionId, storeId);

      res.status(200).json({
        success: true,
        data: orders,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/orders/:id/confirm
   * Order confirmation foundation
   */
  async confirmOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const sessionId = req.body?.sessionId || (req.headers['x-session-id'] as string) || '';
      const storeId = req.body?.storeId || '';

      const order = await orderService.confirmOrder(id, {
        sessionId,
        storeId,
      });

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();
