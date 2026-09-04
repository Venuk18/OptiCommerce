import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface MerchantTokenPayload {
  merchantId: string;
}

function getSecret(): string {
  const secret = config.jwtSecret || process.env.JWT_SECRET;
  if (!secret) {
    if (config.nodeEnv === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return 'opticommerce-dev-secret-jwt-key-2026';
  }
  return secret;
}

/**
 * Signs a minimal JWT containing only the merchant ID.
 * Default expiry: 7 days.
 */
export function signMerchantToken(merchantId: string, expiresIn: string | number = '7d'): string {
  if (!merchantId || typeof merchantId !== 'string') {
    throw new Error('merchantId is required to sign merchant token');
  }

  const payload: MerchantTokenPayload = { merchantId };
  return jwt.sign(payload, getSecret(), { expiresIn } as jwt.SignOptions);
}

/**
 * Verifies a JWT token and extracts the merchantId payload.
 * Throws an error if invalid, expired, or malformed.
 */
export function verifyMerchantToken(token: string): MerchantTokenPayload {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required');
  }

  const decoded = jwt.verify(token, getSecret()) as MerchantTokenPayload;
  if (!decoded || !decoded.merchantId || typeof decoded.merchantId !== 'string') {
    throw new Error('Invalid token payload: merchantId missing');
  }

  return {
    merchantId: decoded.merchantId,
  };
}
