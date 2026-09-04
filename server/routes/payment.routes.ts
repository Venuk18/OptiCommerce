import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';

const router = Router();

// POST /api/payments/create-order - Create Razorpay order from DB total
router.post('/create-order', (req, res, next) =>
  paymentController.createPaymentOrder(req, res, next)
);

// POST /api/payments/verify - Server-side signature verification & order confirmation
router.post('/verify', (req, res, next) =>
  paymentController.verifyPayment(req, res, next)
);

// POST /api/payments/webhook - Razorpay webhook handler
router.post('/webhook', (req, res, next) =>
  paymentController.handleWebhook(req, res, next)
);

export default router;
