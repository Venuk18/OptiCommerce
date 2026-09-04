import { ProductStatus, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';

const ALLOWED_STATUSES: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.PUBLISHED,
  ProductStatus.LOW_STOCK,
  ProductStatus.OUT_OF_STOCK,
  ProductStatus.ARCHIVED,
];

export interface CreateProductInput {
  storeId: string;
  name: string;
  description?: string | null;
  category: string;
  brand?: string | null;
  price: number | string;
  costPrice: number | string;
  stock?: number;
  images?: string[];
  features?: string[];
  specifications?: Record<string, any> | null;
  tags?: string[];
  status?: ProductStatus | string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  category?: string;
  brand?: string | null;
  price?: number | string;
  costPrice?: number | string;
  stock?: number;
  images?: string[];
  features?: string[];
  specifications?: Record<string, any> | null;
  tags?: string[];
  status?: ProductStatus | string;
}

export interface GetProductsFilter {
  storeId?: string;
  category?: string;
  status?: string;
}

export class ProductService {
  async createProduct(data: CreateProductInput) {
    // 1. Validate storeId
    if (!data.storeId || typeof data.storeId !== 'string' || !data.storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }
    const cleanStoreId = data.storeId.trim();

    // Check store exists
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // 2. Validate name
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new AppError('Product name is required', 400);
    }
    const cleanName = data.name.trim();

    // 3. Validate category
    if (!data.category || typeof data.category !== 'string' || !data.category.trim()) {
      throw new AppError('Product category is required', 400);
    }
    const cleanCategory = data.category.trim();

    // 4. Validate price (> 0)
    if (data.price === undefined || data.price === null || data.price === '') {
      throw new AppError('Product price is required', 400);
    }
    const numericPrice = Number(data.price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      throw new AppError('Price must be a valid number greater than 0', 400);
    }

    // 5. Validate costPrice (>= 0)
    if (data.costPrice === undefined || data.costPrice === null || data.costPrice === '') {
      throw new AppError('Product costPrice is required', 400);
    }
    const numericCostPrice = Number(data.costPrice);
    if (isNaN(numericCostPrice) || numericCostPrice < 0) {
      throw new AppError('Cost price must be a valid number greater than or equal to 0', 400);
    }

    // 6. Validate stock (integer >= 0)
    let stockValue = 0;
    if (data.stock !== undefined && data.stock !== null) {
      if (typeof data.stock !== 'number' || !Number.isInteger(data.stock) || data.stock < 0) {
        throw new AppError('Stock must be an integer greater than or equal to 0', 400);
      }
      stockValue = data.stock;
    }

    // 7. Validate status
    let productStatus: ProductStatus = ProductStatus.DRAFT;
    if (data.status) {
      if (!ALLOWED_STATUSES.includes(data.status as ProductStatus)) {
        throw new AppError(
          `Invalid product status: ${data.status}. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
          400
        );
      }
      productStatus = data.status as ProductStatus;
    }

    // 8. Validate arrays
    if (data.images !== undefined && !Array.isArray(data.images)) {
      throw new AppError('Images must be an array of image URLs', 400);
    }
    const cleanImages = (data.images || []).map((img) => String(img).trim()).filter(Boolean);

    if (data.features !== undefined && !Array.isArray(data.features)) {
      throw new AppError('Features must be an array of strings', 400);
    }
    const cleanFeatures = (data.features || []).map((f) => String(f).trim()).filter(Boolean);

    if (data.tags !== undefined && !Array.isArray(data.tags)) {
      throw new AppError('Tags must be an array of strings', 400);
    }
    const cleanTags = (data.tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean);

    // 9. Specifications
    let specificationsJson: Prisma.ProductCreateInput['specifications'] = undefined;
    if (data.specifications !== undefined) {
      if (data.specifications === null) {
        specificationsJson = Prisma.JsonNull;
      } else if (typeof data.specifications === 'object' && !Array.isArray(data.specifications)) {
        specificationsJson = data.specifications as Prisma.InputJsonObject;
      } else {
        throw new AppError('Specifications must be an object or null', 400);
      }
    }

    const cleanDescription = data.description ? data.description.trim() : null;
    const cleanBrand = data.brand ? data.brand.trim() : null;

    const product = await prisma.product.create({
      data: {
        storeId: cleanStoreId,
        name: cleanName,
        description: cleanDescription,
        category: cleanCategory,
        brand: cleanBrand,
        price: numericPrice,
        costPrice: numericCostPrice,
        stock: stockValue,
        images: cleanImages,
        features: cleanFeatures,
        specifications: specificationsJson,
        tags: cleanTags,
        status: productStatus,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    return product;
  }

  async getProducts(filters: GetProductsFilter = {}) {
    const where: Prisma.ProductWhereInput = {};

    if (filters.storeId && typeof filters.storeId === 'string' && filters.storeId.trim()) {
      where.storeId = filters.storeId.trim();
    }

    if (filters.category && typeof filters.category === 'string' && filters.category.trim()) {
      where.category = {
        equals: filters.category.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.status && typeof filters.status === 'string' && filters.status.trim()) {
      const statusUpper = filters.status.trim().toUpperCase();
      if (!ALLOWED_STATUSES.includes(statusUpper as ProductStatus)) {
        throw new AppError(
          `Invalid status filter: ${filters.status}. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
          400
        );
      }
      where.status = statusUpper as ProductStatus;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return products;
  }

  async getProductById(id: string) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError('Product ID is required', 400);
    }

    const product = await prisma.product.findUnique({
      where: { id: id.trim() },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            merchantId: true,
          },
        },
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return product;
  }

  async updateProduct(id: string, data: UpdateProductInput) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError('Product ID is required', 400);
    }
    const cleanId = id.trim();

    // Check product exists
    const existing = await prisma.product.findUnique({
      where: { id: cleanId },
    });
    if (!existing) {
      throw new AppError('Product not found', 404);
    }

    const updateData: Prisma.ProductUpdateInput = {};

    // 1. Name
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        throw new AppError('Product name cannot be empty', 400);
      }
      updateData.name = data.name.trim();
    }

    // 2. Description
    if (data.description !== undefined) {
      updateData.description = data.description ? data.description.trim() : null;
    }

    // 3. Category
    if (data.category !== undefined) {
      if (typeof data.category !== 'string' || !data.category.trim()) {
        throw new AppError('Product category cannot be empty', 400);
      }
      updateData.category = data.category.trim();
    }

    // 4. Brand
    if (data.brand !== undefined) {
      updateData.brand = data.brand ? data.brand.trim() : null;
    }

    // 5. Price
    if (data.price !== undefined) {
      const numericPrice = Number(data.price);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        throw new AppError('Price must be a valid number greater than 0', 400);
      }
      updateData.price = numericPrice;
    }

    // 6. Cost Price
    if (data.costPrice !== undefined) {
      const numericCostPrice = Number(data.costPrice);
      if (isNaN(numericCostPrice) || numericCostPrice < 0) {
        throw new AppError('Cost price must be a valid number greater than or equal to 0', 400);
      }
      updateData.costPrice = numericCostPrice;
    }

    // 7. Stock
    if (data.stock !== undefined) {
      if (typeof data.stock !== 'number' || !Number.isInteger(data.stock) || data.stock < 0) {
        throw new AppError('Stock must be an integer greater than or equal to 0', 400);
      }
      updateData.stock = data.stock;
    }

    // 8. Images
    if (data.images !== undefined) {
      if (!Array.isArray(data.images)) {
        throw new AppError('Images must be an array of image URLs', 400);
      }
      updateData.images = data.images.map((img) => String(img).trim()).filter(Boolean);
    }

    // 9. Features
    if (data.features !== undefined) {
      if (!Array.isArray(data.features)) {
        throw new AppError('Features must be an array of strings', 400);
      }
      updateData.features = data.features.map((f) => String(f).trim()).filter(Boolean);
    }

    // 10. Tags
    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        throw new AppError('Tags must be an array of strings', 400);
      }
      updateData.tags = data.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    }

    // 11. Specifications
    if (data.specifications !== undefined) {
      if (data.specifications === null) {
        updateData.specifications = Prisma.JsonNull;
      } else if (typeof data.specifications === 'object' && !Array.isArray(data.specifications)) {
        updateData.specifications = data.specifications as Prisma.InputJsonObject;
      } else {
        throw new AppError('Specifications must be an object or null', 400);
      }
    }

    // 12. Status
    if (data.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(data.status as ProductStatus)) {
        throw new AppError(
          `Invalid product status: ${data.status}. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
          400
        );
      }
      updateData.status = data.status as ProductStatus;
    }

    const updated = await prisma.product.update({
      where: { id: cleanId },
      data: updateData,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    return updated;
  }

  async updateProductStatus(id: string, status: string) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError('Product ID is required', 400);
    }
    if (!status || typeof status !== 'string' || !status.trim()) {
      throw new AppError('Status is required', 400);
    }

    const cleanStatus = status.trim().toUpperCase() as ProductStatus;
    if (!ALLOWED_STATUSES.includes(cleanStatus)) {
      throw new AppError(
        `Invalid product status: ${status}. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
        400
      );
    }

    const cleanId = id.trim();

    const existing = await prisma.product.findUnique({
      where: { id: cleanId },
    });
    if (!existing) {
      throw new AppError('Product not found', 404);
    }

    const updated = await prisma.product.update({
      where: { id: cleanId },
      data: {
        status: cleanStatus,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    return updated;
  }

  async deleteProduct(id: string) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError('Product ID is required', 400);
    }
    const cleanId = id.trim();

    const existing = await prisma.product.findUnique({
      where: { id: cleanId },
    });
    if (!existing) {
      throw new AppError('Product not found', 404);
    }

    await prisma.product.delete({
      where: { id: cleanId },
    });

    return { id: cleanId, deleted: true };
  }
}

export const productService = new ProductService();
