import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app.error';
import { verifyMerchantToken } from '../utils/jwt';
import { authService } from '../services/auth.service';
import { prisma } from '../db/prisma';
import '../types/auth.types';

/**
 * Express middleware to authenticate merchant requests using JWT Bearer tokens.
 */
export async function requireMerchantAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new AppError('Authorization header missing or invalid', 401);
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Malformed authorization header. Expected "Bearer <token>"', 401);
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new AppError('Authorization token is missing', 401);
    }

    let payload;
    try {
      payload = verifyMerchantToken(token);
    } catch (err: any) {
      throw new AppError('Invalid or expired authentication token', 401);
    }

    let merchant;
    try {
      merchant = await authService.getCurrentMerchant(payload.merchantId);
    } catch {
      throw new AppError('Authenticated merchant account no longer exists or is invalid', 401);
    }
    if (!merchant) {
      throw new AppError('Authenticated merchant account no longer exists', 401);
    }

    // Attach verified merchant identity to request object
    req.merchant = {
      id: merchant.id,
      name: merchant.name,
      email: merchant.email,
      storeId: merchant.store?.id,
      storeSlug: merchant.store?.slug,
      store: merchant.store,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Verifies that a given storeId belongs to the authenticated merchant in req.merchant.id
 */
export async function verifyStoreOwnership(merchantId: string, storeId: string): Promise<boolean> {
  if (!merchantId || !storeId) return false;
  const store = await prisma.store.findUnique({
    where: { id: storeId.trim() },
    select: { id: true, merchantId: true },
  });
  return !!store && store.merchantId === merchantId;
}
