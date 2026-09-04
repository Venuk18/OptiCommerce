import { Router } from 'express';
import { commercialController } from '../controllers/revenue/commercial.controller';

const router = Router();

// POST /api/commercial/decision - Evaluate commercial intervention for customer
router.post('/decision', (req, res, next) =>
  commercialController.evaluateDecision(req, res, next)
);

// POST /api/commercial/accept - Accept commercial offer
router.post('/accept', (req, res, next) =>
  commercialController.acceptOffer(req, res, next)
);

// POST /api/commercial/reject - Decline commercial offer
router.post('/reject', (req, res, next) =>
  commercialController.rejectOffer(req, res, next)
);

// GET /api/commercial/intelligence/:storeId - Merchant-only commercial revenue intelligence
router.get('/intelligence/:storeId', (req, res, next) =>
  commercialController.getCommercialIntelligence(req, res, next)
);

export default router;
