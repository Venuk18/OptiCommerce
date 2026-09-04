import { Router } from 'express';
import { eventController } from '../controllers/event.controller';

const router = Router();

// POST /api/events - Record anonymous customer commerce event
router.post('/', (req, res, next) => eventController.createEvent(req, res, next));

export default router;
