import { Router } from 'express';
import { productController } from '../controllers/product.controller';

const router = Router();

router.post('/', (req, res, next) => productController.createProduct(req, res, next));
router.get('/', (req, res, next) => productController.getProducts(req, res, next));
router.get('/:id', (req, res, next) => productController.getProductById(req, res, next));
router.put('/:id', (req, res, next) => productController.updateProduct(req, res, next));
router.patch('/:id/status', (req, res, next) => productController.updateProductStatus(req, res, next));
router.delete('/:id', (req, res, next) => productController.deleteProduct(req, res, next));

export default router;
