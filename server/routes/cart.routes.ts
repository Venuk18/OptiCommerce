import { Router } from 'express';
import { cartController } from '../controllers/cart.controller';

const router = Router();

// GET /api/cart - Get current session's cart for a store
router.get('/', (req, res, next) => cartController.getCart(req, res, next));

// POST /api/cart/bundles - Deterministic complementary product bundle / cross-sell suggestions
router.post('/bundles', (req, res, next) => cartController.getBundleSuggestions(req, res, next));

// POST /api/cart/items - Add an item to cart
router.post('/items', (req, res, next) => cartController.addItem(req, res, next));

// PATCH /api/cart/items/:itemId - Update item quantity
router.patch('/items/:itemId', (req, res, next) => cartController.updateItem(req, res, next));

// DELETE /api/cart/items/:itemId - Remove item from cart
router.delete('/items/:itemId', (req, res, next) => cartController.removeItem(req, res, next));

// DELETE /api/cart - Clear all items in cart
router.delete('/', (req, res, next) => cartController.clearCart(req, res, next));

export default router;
