import { Request, Response, NextFunction } from 'express';
import { storeService } from '../services/store.service';

export class StoreController {
  async createStore(req: Request, res: Response, next: NextFunction) {
    try {
      const { merchantId, name, slug, description } = req.body;
      const store = await storeService.createStore({ merchantId, name, slug, description });
      res.status(201).json({
        success: true,
        data: store,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStoreBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const store = await storeService.getStoreBySlug(slug);
      res.status(200).json({
        success: true,
        data: store,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStore(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, slug, description } = req.body;
      const store = await storeService.updateStore(id, { name, slug, description });
      res.status(200).json({
        success: true,
        data: store,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStoreStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const store = await storeService.updateStoreStatus(id, status);
      res.status(200).json({
        success: true,
        data: store,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const storeController = new StoreController();
