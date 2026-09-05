import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { optionalCustomerAuth } from '../middleware/customer-auth.middleware';

const router = Router();

// Apply optionalCustomerAuth middleware (allows unauthenticated guest requests with no Authorization header)
router.use(optionalCustomerAuth);

// POST /api/orders/checkout - Server-authoritative cart checkout
router.post('/checkout', (req, res, next) => orderController.checkout(req, res, next));

// GET /api/orders - List customer orders
router.get('/', (req, res, next) => orderController.listOrders(req, res, next));

// GET /api/orders/:id - Get single customer order
router.get('/:id', (req, res, next) => orderController.getOrder(req, res, next));

// PATCH /api/orders/:id/confirm - Confirm order foundation
router.patch('/:id/confirm', (req, res, next) => orderController.confirmOrder(req, res, next));

export default router;
