import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { requireMerchantAuth } from '../middleware/auth.middleware';

const router = Router();

// Public customer reads
router.get('/', (req, res, next) => productController.getProducts(req, res, next));
router.get('/:id', (req, res, next) => productController.getProductById(req, res, next));

// Protected merchant mutations
router.post('/', requireMerchantAuth, (req, res, next) => productController.createProduct(req, res, next));
router.put('/:id', requireMerchantAuth, (req, res, next) => productController.updateProduct(req, res, next));
router.patch('/:id/status', requireMerchantAuth, (req, res, next) => productController.updateProductStatus(req, res, next));
router.delete('/:id', requireMerchantAuth, (req, res, next) => productController.deleteProduct(req, res, next));

export default router;

