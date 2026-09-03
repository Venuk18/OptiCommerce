import { Request, Response, NextFunction } from 'express';
import { storeService } from '../services/store.service';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';

export class StoreController {
  async createStore(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, slug, description } = req.body;
      const merchantId = req.merchant?.id;

      if (!merchantId) {
        throw new AppError('Merchant authentication required', 401);
      }

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
      if (!id || typeof id !== 'string' || !id.trim()) {
        throw new AppError('Store ID is required', 400);
      }

      const existingStore = await prisma.store.findUnique({
        where: { id: id.trim() },
      });

      if (!existingStore) {
        throw new AppError('Store not found', 404);
      }

      if (!req.merchant || existingStore.merchantId !== req.merchant.id) {
        throw new AppError('Forbidden: You do not have permission to modify this store', 403);
      }

      const { name, slug, description } = req.body;
      const store = await storeService.updateStore(id.trim(), { name, slug, description });
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
      if (!id || typeof id !== 'string' || !id.trim()) {
        throw new AppError('Store ID is required', 400);
      }

      const existingStore = await prisma.store.findUnique({
        where: { id: id.trim() },
      });

      if (!existingStore) {
        throw new AppError('Store not found', 404);
      }

      if (!req.merchant || existingStore.merchantId !== req.merchant.id) {
        throw new AppError('Forbidden: You do not have permission to modify this store', 403);
      }

      const { status } = req.body;
      const store = await storeService.updateStoreStatus(id.trim(), status);
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

