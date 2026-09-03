import { Router } from 'express';
import { merchantController } from '../controllers/merchant.controller';
import { requireMerchantAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/', (req, res, next) => merchantController.createMerchant(req, res, next));
router.get('/:id', requireMerchantAuth, (req, res, next) => merchantController.getMerchantById(req, res, next));

export default router;

