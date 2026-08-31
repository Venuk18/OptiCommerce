import { Router } from 'express';
import { intentController } from '../controllers/ai/intent.controller';
import { searchController } from '../controllers/ai/search.controller';
import { rankingController } from '../controllers/ai/ranking.controller';
import { recommendationController } from '../controllers/ai/recommendation.controller';

const router = Router();

// POST /api/ai/intent - Customer Intent Extraction (Phase 4A)
router.post('/intent', (req, res, next) => intentController.extractIntent(req, res, next));

// POST /api/ai/search - Candidate Product Retrieval (Phase 4B)
router.post('/search', (req, res, next) => searchController.searchCandidates(req, res, next));

// POST /api/ai/rank - AI Candidate Product Ranking (Phase 4C)
router.post('/rank', (req, res, next) => rankingController.rankCandidates(req, res, next));

// POST /api/ai/recommend - Customer AI Search Orchestration (Phase 4D)
router.post('/recommend', (req, res, next) => recommendationController.getRecommendations(req, res, next));

export default router;
