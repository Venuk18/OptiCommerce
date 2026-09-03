import { Request, Response, NextFunction } from 'express';
import { descriptionGeneratorService } from '../../services/ai/description-generator.service';
import { AppError } from '../../errors/app.error';

export class DescriptionController {
  async generateDescription(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.merchant) {
        throw new AppError('Authentication required: Merchant session not found', 401);
      }

      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Invalid request body: Expected an object', 400);
      }

      // Check request size
      if (JSON.stringify(body).length > 20000) {
        throw new AppError('Request payload exceeds maximum allowed size', 400);
      }

      const { name, category, brand, tags, features, specifications } = body;

      // Validate name
      if (name === undefined || name === null) {
        throw new AppError('Product name is required', 400);
      }
      if (typeof name !== 'string') {
        throw new AppError('Product name must be a string', 400);
      }
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        throw new AppError('Product name cannot be empty', 400);
      }
      if (trimmedName.length > 255) {
        throw new AppError('Product name exceeds maximum length of 255 characters', 400);
      }

      // Validate category
      let cleanCategory = 'General';
      if (category !== undefined && category !== null) {
        if (typeof category !== 'string') {
          throw new AppError('Category must be a string', 400);
        }
        if (category.trim().length > 0) {
          cleanCategory = category.trim();
        }
      }

      // Validate optional brand
      let cleanBrand: string | undefined = undefined;
      if (brand !== undefined && brand !== null) {
        if (typeof brand !== 'string') {
          throw new AppError('Brand must be a string', 400);
        }
        cleanBrand = brand.trim();
      }

      // Validate optional tags
      let cleanTags: string[] | undefined = undefined;
      if (tags !== undefined && tags !== null) {
        if (!Array.isArray(tags)) {
          throw new AppError('Tags must be an array of strings', 400);
        }
        cleanTags = tags
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t) => t.trim().slice(0, 50))
          .slice(0, 20);
      }

      // Validate optional features
      let cleanFeatures: string[] | undefined = undefined;
      if (features !== undefined && features !== null) {
        if (!Array.isArray(features)) {
          throw new AppError('Features must be an array of strings', 400);
        }
        cleanFeatures = features
          .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
          .map((f) => f.trim().slice(0, 100))
          .slice(0, 20);
      }

      // Validate optional specifications
      let cleanSpecs: Record<string, any> | undefined = undefined;
      if (specifications !== undefined && specifications !== null) {
        if (typeof specifications !== 'object' || Array.isArray(specifications)) {
          throw new AppError('Specifications must be an object', 400);
        }
        cleanSpecs = {};
        for (const [k, v] of Object.entries(specifications).slice(0, 20)) {
          if (typeof k === 'string' && k.trim().length > 0) {
            cleanSpecs[k.trim().slice(0, 50)] = String(v).slice(0, 100);
          }
        }
      }

      const result = await descriptionGeneratorService.generateDescription({
        name: trimmedName,
        category: cleanCategory,
        brand: cleanBrand,
        tags: cleanTags,
        features: cleanFeatures,
        specifications: cleanSpecs,
      });

      res.status(200).json({
        success: true,
        data: {
          description: result.description,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const descriptionController = new DescriptionController();
