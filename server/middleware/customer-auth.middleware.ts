import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app.error';
import { verifyCustomerToken, CustomerTokenPayload } from '../utils/jwt';
import { customerAuthService } from '../services/customer-auth.service';
import '../types/customer-auth.types';

/**
 * Express middleware to authenticate customer requests using Customer JWT Bearer tokens.
 * Enforces strict token isolation: merchant tokens and forged tokens are rejected with 401.
 */
export async function requireCustomerAuth(req: Request, _res: Response, next: NextFunction) {
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

    let payload: CustomerTokenPayload;
    try {
      payload = verifyCustomerToken(token);
    } catch (err: any) {
      throw new AppError('Invalid or expired customer authentication token', 401);
    }

    // Verify customer exists and belongs to the token storeId
    let customer;
    try {
      customer = await customerAuthService.getCurrentCustomer(payload.customerId, payload.storeId);
    } catch (err: any) {
      if (err instanceof AppError && err.statusCode === 404) {
        throw new AppError('Authenticated customer account no longer exists', 401);
      }
      throw err;
    }

    if (!customer) {
      throw new AppError('Authenticated customer account no longer exists', 401);
    }

    // Attach verified customer identity to request object
    req.customer = {
      customerId: payload.customerId,
      storeId: payload.storeId,
      role: 'customer',
      profile: customer,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Express middleware that optionally extracts customer identity if a valid Customer JWT is present.
 * Does not reject requests when Authorization header is absent or invalid (continues as guest).
 */
export async function optionalCustomerAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        try {
          const payload = verifyCustomerToken(token);
          req.customer = {
            customerId: payload.customerId,
            storeId: payload.storeId,
            role: 'customer',
          };
        } catch {
          // Token is invalid, expired, or merchant token; continue as unauthenticated guest
        }
      }
    }
    next();
  } catch {
    next();
  }
}
