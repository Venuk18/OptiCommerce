import { Router } from 'express';
import { storeController } from '../controllers/store.controller';
import { requireMerchantAuth } from '../middleware/auth.middleware';

const router = Router();

// Public customer store lookup
router.get('/:slug', (req, res, next) => storeController.getStoreBySlug(req, res, next));

// Protected merchant mutations
router.post('/', requireMerchantAuth, (req, res, next) => storeController.createStore(req, res, next));
router.put('/:id', requireMerchantAuth, (req, res, next) => storeController.updateStore(req, res, next));
router.patch('/:id/status', requireMerchantAuth, (req, res, next) => storeController.updateStoreStatus(req, res, next));

export default router;

