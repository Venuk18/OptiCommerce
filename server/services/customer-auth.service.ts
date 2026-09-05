import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';
import { hashPassword, verifyPassword } from '../utils/password';
import { signCustomerToken } from '../utils/jwt';
import { SafeCustomer, CustomerAuthResult } from '../types/customer-auth.types';

export interface CustomerRegisterInput {
  storeId: string;
  email: string;
  password: string;
  name?: string | null;
}

export interface CustomerLoginInput {
  storeId: string;
  email: string;
  password: string;
}

export class CustomerAuthService {
  /**
   * Serializes a database Customer record into a safe, non-sensitive DTO.
   * Explicitly ensures passwordHash, credentials, and internal fields are never exposed.
   */
  toSafeCustomer(customer: any): SafeCustomer {
    return {
      id: customer.id,
      storeId: customer.storeId,
      name: customer.name ?? null,
      email: customer.email,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  /**
   * Registers a new customer for a specific store.
   * Scoped by [storeId, email] compound constraint.
   */
  async register(data: CustomerRegisterInput): Promise<CustomerAuthResult> {
    if (!data.storeId || typeof data.storeId !== 'string' || !data.storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    if (!data.email || typeof data.email !== 'string' || !data.email.trim()) {
      throw new AppError('Email is required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = data.email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      throw new AppError('Invalid email format', 400);
    }

    if (!data.password || typeof data.password !== 'string' || data.password.trim().length === 0) {
      throw new AppError('Password is required', 400);
    }

    if (data.password.length < 6) {
      throw new AppError('Password must be at least 6 characters long', 400);
    }

    const cleanStoreId = data.storeId.trim();
    const cleanName =
      data.name && typeof data.name === 'string' && data.name.trim() ? data.name.trim() : null;

    // Verify the requested store exists
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // Check if customer already exists for this store
    const existing = await prisma.customer.findUnique({
      where: {
        storeId_email: {
          storeId: cleanStoreId,
          email: cleanEmail,
        },
      },
    });

    if (existing) {
      throw new AppError('Customer with this email already exists for this store', 409);
    }

    // Hash password with bcryptjs
    const passwordHash = await hashPassword(data.password);

    let customer;
    try {
      customer = await prisma.customer.create({
        data: {
          storeId: cleanStoreId,
          email: cleanEmail,
          passwordHash,
          name: cleanName,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new AppError('Customer with this email already exists for this store', 409);
      }
      throw err;
    }

    // Issue Customer JWT
    const token = signCustomerToken({
      customerId: customer.id,
      storeId: customer.storeId,
    });

    return {
      customer: this.toSafeCustomer(customer),
      token,
    };
  }

  /**
   * Authenticates a customer within a specific store.
   * Generic failure message used to prevent email enumeration.
   */
  async login(data: CustomerLoginInput): Promise<CustomerAuthResult> {
    if (!data.storeId || typeof data.storeId !== 'string' || !data.storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    if (!data.email || typeof data.email !== 'string' || !data.email.trim()) {
      throw new AppError('Email is required', 400);
    }

    if (!data.password || typeof data.password !== 'string') {
      throw new AppError('Password is required', 400);
    }

    const cleanStoreId = data.storeId.trim();
    const cleanEmail = data.email.trim().toLowerCase();

    const genericAuthError = new AppError('Invalid email or password', 401);

    const customer = await prisma.customer.findUnique({
      where: {
        storeId_email: {
          storeId: cleanStoreId,
          email: cleanEmail,
        },
      },
    });

    if (!customer) {
      throw genericAuthError;
    }

    const isValid = await verifyPassword(data.password, customer.passwordHash);
    if (!isValid) {
      throw genericAuthError;
    }

    const token = signCustomerToken({
      customerId: customer.id,
      storeId: customer.storeId,
    });

    return {
      customer: this.toSafeCustomer(customer),
      token,
    };
  }

  /**
   * Fetches the safe customer profile by customerId and verifies store ownership.
   */
  async getCurrentCustomer(customerId: string, tokenStoreId: string): Promise<SafeCustomer> {
    if (!customerId || typeof customerId !== 'string' || !customerId.trim()) {
      throw new AppError('Unauthorized: Missing customer identity', 401);
    }

    if (!tokenStoreId || typeof tokenStoreId !== 'string' || !tokenStoreId.trim()) {
      throw new AppError('Unauthorized: Missing store scope in token', 401);
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId.trim() },
    });

    if (!customer) {
      throw new AppError('Customer not found or inactive', 404);
    }

    // Strict Store Isolation: customer must belong to the token storeId
    if (customer.storeId !== tokenStoreId.trim()) {
      throw new AppError('Unauthorized: Customer does not belong to this store', 401);
    }

    return this.toSafeCustomer(customer);
  }
}

export const customerAuthService = new CustomerAuthService();
