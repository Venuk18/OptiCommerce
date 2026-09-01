import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment/payment.service';

export class PaymentController {
  /**
   * POST /api/payments/create-order
   * Creates a Razorpay order from the authoritative Order total in PostgreSQL.
   */
  async createPaymentOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const orderId = req.body?.orderId || '';
      const sessionId =
        req.body?.sessionId || (req.headers['x-session-id'] as string) || '';
      const storeId =
        req.body?.storeId || (req.headers['x-store-id'] as string) || '';

      const paymentData = await paymentService.createPaymentOrder({
        orderId,
        sessionId,
        storeId,
      });

      res.status(201).json({
        success: true,
        data: paymentData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/verify
   * Verifies Razorpay HMAC signature and confirms order payment status.
   */
  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      } = req.body || {};

      const sessionId =
        req.body?.sessionId || (req.headers['x-session-id'] as string) || '';
      const storeId =
        req.body?.storeId || (req.headers['x-store-id'] as string) || '';

      const verificationResult = await paymentService.verifyPayment({
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        sessionId,
        storeId,
      });

      res.status(200).json({
        success: true,
        data: verificationResult,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/webhook
   * Handles asynchronous Razorpay payment webhook notifications.
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = (req.headers['x-razorpay-signature'] as string) || '';
      const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});
      const eventData = req.body || {};

      const result = await paymentService.handleWebhook(
        rawBody,
        signature,
        eventData
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
