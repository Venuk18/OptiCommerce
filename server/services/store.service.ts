import { StoreStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';

export interface CreateStoreInput {
  merchantId: string;
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateStoreInput {
  name?: string;
  slug?: string;
  description?: string | null;
}

export class StoreService {
  async createStore(data: CreateStoreInput) {
    if (!data.merchantId || typeof data.merchantId !== 'string' || !data.merchantId.trim()) {
      throw new AppError('merchantId is required', 400);
    }
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new AppError('Store name is required', 400);
    }
    if (!data.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
      throw new AppError('Store slug is required', 400);
    }

    const cleanMerchantId = data.merchantId.trim();
    const cleanName = data.name.trim();
    const cleanSlug = data.slug.trim().toLowerCase();
    const cleanDescription = data.description ? data.description.trim() : null;

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(cleanSlug)) {
      throw new AppError('Slug must contain only lowercase letters, numbers, and hyphens', 400);
    }

    // Check if merchant exists
    const merchant = await prisma.merchant.findUnique({
      where: { id: cleanMerchantId },
      include: { store: true },
    });

    if (!merchant) {
      throw new AppError('Merchant not found', 404);
    }

    // Check if merchant already has a store
    if (merchant.store) {
      throw new AppError('Merchant already has an associated store', 409);
    }

    // Check if slug is already taken
    const existingSlug = await prisma.store.findUnique({
      where: { slug: cleanSlug },
    });

    if (existingSlug) {
      throw new AppError('Store slug already exists', 409);
    }

    const store = await prisma.store.create({
      data: {
        merchantId: cleanMerchantId,
        name: cleanName,
        slug: cleanSlug,
        description: cleanDescription,
        status: StoreStatus.UNPUBLISHED,
      },
    });

    return store;
  }

  async getStoreBySlug(slug: string) {
    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      throw new AppError('Store slug is required', 400);
    }

    const cleanSlug = slug.trim().toLowerCase();

    const store = await prisma.store.findUnique({
      where: { slug: cleanSlug },
      include: {
        merchant: true,
      },
    });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    return store;
  }

  async updateStore(id: string, data: UpdateStoreInput) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError('Store ID is required', 400);
    }

    const cleanId = id.trim();

    // Check if store exists
    const existingStore = await prisma.store.findUnique({
      where: { id: cleanId },
    });

    if (!existingStore) {
      throw new AppError('Store not found', 404);
    }

    const updateData: { name?: string; slug?: string; description?: string | null } = {};

    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        throw new AppError('Store name cannot be empty', 400);
      }
      updateData.name = data.name.trim();
    }

    if (data.slug !== undefined) {
      if (typeof data.slug !== 'string' || !data.slug.trim()) {
        throw new AppError('Store slug cannot be empty', 400);
      }
      const cleanSlug = data.slug.trim().toLowerCase();
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(cleanSlug)) {
        throw new AppError('Slug must contain only lowercase letters, numbers, and hyphens', 400);
      }

      // If slug is changing, verify it's not taken by another store
      if (cleanSlug !== existingStore.slug) {
        const slugConflict = await prisma.store.findUnique({
          where: { slug: cleanSlug },
        });
        if (slugConflict && slugConflict.id !== cleanId) {
          throw new AppError('Store slug already exists', 409);
        }
      }
      updateData.slug = cleanSlug;
    }

    if (data.description !== undefined) {
      updateData.description = data.description ? data.description.trim() : null;
    }

    const updatedStore = await prisma.store.update({
      where: { id: cleanId },
      data: updateData,
    });

    return updatedStore;
  }

  async updateStoreStatus(id: string, status: string) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError('Store ID is required', 400);
    }

    if (status !== StoreStatus.PUBLISHED && status !== StoreStatus.UNPUBLISHED) {
      throw new AppError('Invalid store status. Allowed values: PUBLISHED, UNPUBLISHED', 400);
    }

    const cleanId = id.trim();

    const existingStore = await prisma.store.findUnique({
      where: { id: cleanId },
    });

    if (!existingStore) {
      throw new AppError('Store not found', 404);
    }

    const updatedStore = await prisma.store.update({
      where: { id: cleanId },
      data: {
        status: status as StoreStatus,
      },
    });

    return updatedStore;
  }
}

export const storeService = new StoreService();
