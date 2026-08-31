import { Router } from 'express';
import { merchantController } from '../controllers/merchant.controller';

const router = Router();

router.post('/', (req, res, next) => merchantController.createMerchant(req, res, next));
router.get('/:id', (req, res, next) => merchantController.getMerchantById(req, res, next));

export default router;
