import { Router } from 'express';
import { storeController } from '../controllers/store.controller';

const router = Router();

router.post('/', (req, res, next) => storeController.createStore(req, res, next));
router.get('/:slug', (req, res, next) => storeController.getStoreBySlug(req, res, next));
router.put('/:id', (req, res, next) => storeController.updateStore(req, res, next));
router.patch('/:id/status', (req, res, next) => storeController.updateStoreStatus(req, res, next));

export default router;
