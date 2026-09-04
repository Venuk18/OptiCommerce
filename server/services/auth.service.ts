import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';
import { hashPassword, verifyPassword } from '../utils/password';
import { signMerchantToken } from '../utils/jwt';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  storeName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SafeMerchant {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  store: {
    id: string;
    merchantId: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

export interface AuthResult {
  merchant: SafeMerchant;
  token: string;
}

export class AuthService {
  /**
   * Helper to generate a clean, unique store slug.
   */
  private async generateUniqueSlug(base: string): Promise<string> {
    const cleanBase = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'store';

    let slug = cleanBase;
    let counter = 1;

    while (true) {
      const existing = await prisma.store.findUnique({
        where: { slug },
      });
      if (!existing) {
        return slug;
      }
      slug = `${cleanBase}-${counter}`;
      counter++;
    }
  }

  /**
   * Register a new merchant with an associated store and hashed password.
   */
  async register(data: RegisterInput): Promise<AuthResult> {
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

    if (!data.password || typeof data.password !== 'string' || data.password.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400);
    }

    const cleanName = data.name.trim();

    // Check if email is already taken
    const existing = await prisma.merchant.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      throw new AppError('Merchant with this email already exists', 409);
    }

    // Hash password securely
    const passwordHash = await hashPassword(data.password);

    // Prepare store name and slug
    const initialStoreName = data.storeName && data.storeName.trim()
      ? data.storeName.trim()
      : `${cleanName}'s Store`;
    const initialStoreSlug = await this.generateUniqueSlug(data.storeName || cleanName);

    // Create merchant & store atomically
    const merchant = await prisma.merchant.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        store: {
          create: {
            name: initialStoreName,
            slug: initialStoreSlug,
            description: `Official storefront for ${cleanName}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: {
        store: true,
      },
    });

    const token = signMerchantToken(merchant.id);

    const safeMerchant: SafeMerchant = {
      id: merchant.id,
      name: merchant.name,
      email: merchant.email,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
      store: merchant.store
        ? {
            id: merchant.store.id,
            merchantId: merchant.store.merchantId,
            name: merchant.store.name,
            slug: merchant.store.slug,
            description: merchant.store.description,
            status: merchant.store.status,
            createdAt: merchant.store.createdAt,
            updatedAt: merchant.store.updatedAt,
          }
        : null,
    };

    return {
      merchant: safeMerchant,
      token,
    };
  }

  /**
   * Authenticate an existing merchant via email and password.
   */
  async login(data: LoginInput): Promise<AuthResult> {
    if (!data.email || typeof data.email !== 'string' || !data.email.trim()) {
      throw new AppError('Email is required', 400);
    }

    if (!data.password || typeof data.password !== 'string') {
      throw new AppError('Password is required', 400);
    }

    const cleanEmail = data.email.trim().toLowerCase();

    // Generic error to prevent email enumeration
    const genericAuthError = new AppError('Invalid email or password', 401);

    const merchant = await prisma.merchant.findUnique({
      where: { email: cleanEmail },
      include: {
        store: true,
      },
    });

    if (!merchant) {
      throw genericAuthError;
    }

    const isValid = await verifyPassword(data.password, merchant.passwordHash);
    if (!isValid) {
      throw genericAuthError;
    }

    const token = signMerchantToken(merchant.id);

    const safeMerchant: SafeMerchant = {
      id: merchant.id,
      name: merchant.name,
      email: merchant.email,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
      store: merchant.store
        ? {
            id: merchant.store.id,
            merchantId: merchant.store.merchantId,
            name: merchant.store.name,
            slug: merchant.store.slug,
            description: merchant.store.description,
            status: merchant.store.status,
            createdAt: merchant.store.createdAt,
            updatedAt: merchant.store.updatedAt,
          }
        : null,
    };

    return {
      merchant: safeMerchant,
      token,
    };
  }

  /**
   * Retrieve the authenticated merchant profile and store.
   */
  async getCurrentMerchant(merchantId: string): Promise<SafeMerchant> {
    if (!merchantId || typeof merchantId !== 'string' || !merchantId.trim()) {
      throw new AppError('Unauthorized: Missing merchant identity', 401);
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId.trim() },
      include: {
        store: true,
      },
    });

    if (!merchant) {
      throw new AppError('Merchant not found or inactive', 404);
    }

    return {
      id: merchant.id,
      name: merchant.name,
      email: merchant.email,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
      store: merchant.store
        ? {
            id: merchant.store.id,
            merchantId: merchant.store.merchantId,
            name: merchant.store.name,
            slug: merchant.store.slug,
            description: merchant.store.description,
            status: merchant.store.status,
            createdAt: merchant.store.createdAt,
            updatedAt: merchant.store.updatedAt,
          }
        : null,
    };
  }
}

export const authService = new AuthService();
