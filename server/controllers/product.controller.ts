import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';

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

      const product = await productService.createProduct({
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

      const product = await productService.updateProduct(id, {
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
      const { status } = req.body;

      const product = await productService.updateProductStatus(id, status);

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
      const result = await productService.deleteProduct(id);

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
