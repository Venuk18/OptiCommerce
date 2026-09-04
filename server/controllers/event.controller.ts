import { Request, Response, NextFunction } from 'express';
import { eventService } from '../services/event.service';

export class EventController {
  async createEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, storeId, productId, eventType, metadata } = req.body;

      const event = await eventService.createEvent({
        sessionId,
        storeId,
        productId,
        eventType,
        metadata,
      });

      res.status(201).json({
        success: true,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();
