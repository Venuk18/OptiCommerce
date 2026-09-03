import { Router } from 'express';
import { merchantDashboardController } from '../controllers/merchant-dashboard.controller';
import { requireMerchantAuth } from '../middleware/auth.middleware';

const router = Router();

// Protect all merchant dashboard endpoints
router.use(requireMerchantAuth);

// GET /api/merchant-dashboard/summary?storeId=<storeId>
router.get('/summary', (req, res, next) =>
  merchantDashboardController.getSummary(req, res, next)
);

// GET /api/merchant-dashboard/funnel?storeId=<storeId>
router.get('/funnel', (req, res, next) =>
  merchantDashboardController.getFunnel(req, res, next)
);

// GET /api/merchant-dashboard/attribution?storeId=<storeId>
router.get('/attribution', (req, res, next) =>
  merchantDashboardController.getAttribution(req, res, next)
);

// GET /api/merchant-dashboard/insights?storeId=<storeId>
router.get('/insights', (req, res, next) =>
  merchantDashboardController.getInsights(req, res, next)
);

export default router;

