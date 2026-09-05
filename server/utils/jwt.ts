import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface MerchantTokenPayload {
  merchantId: string;
}

export interface CustomerTokenPayload {
  customerId: string;
  storeId: string;
  role: 'customer';
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
 * Throws an error if invalid, expired, malformed, or if a customer token is provided.
 */
export function verifyMerchantToken(token: string): MerchantTokenPayload {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required');
  }

  const decoded = jwt.verify(token, getSecret()) as any;
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid token payload');
  }

  // Token isolation: customer tokens cannot be used as merchant tokens
  if (decoded.role === 'customer' || decoded.customerId) {
    throw new Error('Invalid token payload: customer token cannot be used as merchant token');
  }

  if (!decoded.merchantId || typeof decoded.merchantId !== 'string') {
    throw new Error('Invalid token payload: merchantId missing');
  }

  return {
    merchantId: decoded.merchantId,
  };
}

/**
 * Signs a minimal JWT for customer authentication containing customerId, storeId, and role 'customer'.
 * Default expiry: 7 days.
 * Security: Contains NO passwords, hashes, credentials, or PII.
 */
export function signCustomerToken(
  payload: { customerId: string; storeId: string; role?: 'customer' },
  expiresIn: string | number = '7d'
): string {
  if (!payload || !payload.customerId || typeof payload.customerId !== 'string') {
    throw new Error('customerId is required to sign customer token');
  }
  if (!payload.storeId || typeof payload.storeId !== 'string') {
    throw new Error('storeId is required to sign customer token');
  }

  const tokenPayload: CustomerTokenPayload = {
    customerId: payload.customerId,
    storeId: payload.storeId,
    role: 'customer',
  };

  return jwt.sign(tokenPayload, getSecret(), { expiresIn } as jwt.SignOptions);
}

/**
 * Verifies a JWT token and extracts the CustomerTokenPayload.
 * Throws an error if invalid, expired, malformed, or if a merchant token is provided.
 */
export function verifyCustomerToken(token: string): CustomerTokenPayload {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required');
  }

  const decoded = jwt.verify(token, getSecret()) as any;
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid token payload');
  }

  // Token isolation: merchant tokens cannot be used as customer tokens
  if (decoded.merchantId && decoded.role !== 'customer') {
    throw new Error('Invalid token payload: merchant token cannot be used as customer token');
  }

  if (decoded.role !== 'customer') {
    throw new Error('Invalid token payload: missing or invalid customer role');
  }

  if (!decoded.customerId || typeof decoded.customerId !== 'string') {
    throw new Error('Invalid token payload: customerId missing');
  }

  if (!decoded.storeId || typeof decoded.storeId !== 'string') {
    throw new Error('Invalid token payload: storeId missing');
  }

  return {
    customerId: decoded.customerId,
    storeId: decoded.storeId,
    role: 'customer',
  };
}
