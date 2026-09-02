import { Router } from 'express';
import { merchantDashboardController } from '../controllers/merchant-dashboard.controller';

const router = Router();

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

export default router;
