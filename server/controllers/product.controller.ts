import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';

export class ProductController {
  async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        storeId,
        name,
        description,
        category,
        brand,
        price,
        costPrice,
        stock,
        images,
        features,
        specifications,
        tags,
        status,
      } = req.body;

      if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
        throw new AppError('storeId is required', 400);
      }

      const targetStore = await prisma.store.findUnique({
        where: { id: storeId.trim() },
        select: { id: true, merchantId: true },
      });

      if (!targetStore) {
        throw new AppError('Store not found', 404);
      }

      if (!req.merchant || targetStore.merchantId !== req.merchant.id) {
        throw new AppError('Forbidden: You do not have permission to create products in this store', 403);
      }

      const product = await productService.createProduct({
        storeId: storeId.trim(),
        name,
        description,
        category,
        brand,
        price,
        costPrice,
        stock,
        images,
        features,
        specifications,
        tags,
        status,
      });

      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { storeId, category, status } = req.query;

      const products = await productService.getProducts({
        storeId: storeId ? String(storeId) : undefined,
        category: category ? String(category) : undefined,
        status: status ? String(status) : undefined,
      });

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await productService.getProductById(id);

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        throw new AppError('Product ID is required', 400);
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id: id.trim() },
        include: { store: true },
      });

      if (!existingProduct) {
        throw new AppError('Product not found', 404);
      }

      if (!req.merchant || existingProduct.store?.merchantId !== req.merchant.id) {
        throw new AppError('Forbidden: You do not have permission to modify this product', 403);
      }

      const {
        name,
        description,
        category,
        brand,
        price,
        costPrice,
        stock,
        images,
        features,
        specifications,
        tags,
        status,
      } = req.body;

      const product = await productService.updateProduct(id.trim(), {
        name,
        description,
        category,
        brand,
        price,
        costPrice,
        stock,
        images,
        features,
        specifications,
        tags,
        status,
      });

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProductStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        throw new AppError('Product ID is required', 400);
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id: id.trim() },
        include: { store: true },
      });

      if (!existingProduct) {
        throw new AppError('Product not found', 404);
      }

      if (!req.merchant || existingProduct.store?.merchantId !== req.merchant.id) {
        throw new AppError('Forbidden: You do not have permission to modify this product', 403);
      }

      const { status } = req.body;

      const product = await productService.updateProductStatus(id.trim(), status);

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        throw new AppError('Product ID is required', 400);
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id: id.trim() },
        include: { store: true },
      });

      if (!existingProduct) {
        throw new AppError('Product not found', 404);
      }

      if (!req.merchant || existingProduct.store?.merchantId !== req.merchant.id) {
        throw new AppError('Forbidden: You do not have permission to delete this product', 403);
      }

      const result = await productService.deleteProduct(id.trim());

      res.status(200).json({
        success: true,
        message: 'Product deleted successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const productController = new ProductController();

