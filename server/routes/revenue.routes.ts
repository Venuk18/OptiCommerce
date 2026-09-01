import { Router } from 'express';
import { purchaseProbabilityController } from '../controllers/revenue/purchase-probability.controller';
import { revenueOptimizerController } from '../controllers/revenue/optimizer.controller';
import { saleRecoveryController } from '../controllers/revenue/sale-recovery.controller';

const router = Router();

// POST /api/revenue/purchase-probability - Estimate deterministic customer purchase likelihood
router.post('/purchase-probability', (req, res, next) =>
  purchaseProbabilityController.getPurchaseProbability(req, res, next)
);

// POST /api/revenue/optimize - Deterministic revenue & discount optimizer
router.post('/optimize', (req, res, next) =>
  revenueOptimizerController.optimize(req, res, next)
);

// POST /api/revenue/recover-sale - Sale recovery recommendations on offer rejection
router.post('/recover-sale', (req, res, next) =>
  saleRecoveryController.recoverSale(req, res, next)
);

export default router;
