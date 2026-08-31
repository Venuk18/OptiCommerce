import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';

export interface CreateMerchantInput {
  name: string;
  email: string;
}

export class MerchantService {
  async createMerchant(data: CreateMerchantInput) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new AppError('Merchant name is required', 400);
    }

    if (!data.email || typeof data.email !== 'string' || !data.email.trim()) {
      throw new AppError('Merchant email is required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = data.email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      throw new AppError('Invalid email format', 400);
    }

    const cleanName = data.name.trim();

    // Check if email already exists
    const existing = await prisma.merchant.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      throw new AppError('Merchant with this email already exists', 409);
    }

    const merchant = await prisma.merchant.create({
      data: {
        name: cleanName,
        email: cleanEmail,
      },
    });

    return merchant;
  }

  async getMerchantById(id: string) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError('Merchant ID is required', 400);
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: id.trim() },
      include: {
        store: true,
      },
    });

    if (!merchant) {
      throw new AppError('Merchant not found', 404);
    }

    return merchant;
  }
}

export const merchantService = new MerchantService();
