import { Router } from 'express';
import { customerAuthController } from '../controllers/customer-auth.controller';
import { requireCustomerAuth } from '../middleware/customer-auth.middleware';

const router = Router();

router.post('/register', (req, res, next) => customerAuthController.register(req, res, next));
router.post('/login', (req, res, next) => customerAuthController.login(req, res, next));
router.get('/me', requireCustomerAuth, (req, res, next) => customerAuthController.getMe(req, res, next));

export default router;
