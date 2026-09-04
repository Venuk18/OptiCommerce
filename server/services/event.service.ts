import { CommerceEventType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';
import { CreateEventInput, VALID_COMMERCE_EVENT_TYPES, CommerceEventResponse } from '../types/event.types';

const FORBIDDEN_METADATA_KEYS = new Set([
  'costprice',
  'cost_price',
  'password',
  'email',
  'phone',
  'phonenumber',
  'phone_number',
  'apikey',
  'api_key',
  'token',
  'secret',
  'creditcard',
  'credit_card',
  'credentials',
  'cvv',
  'cardnumber',
  'card_number',
]);

const MAX_METADATA_SIZE_BYTES = 16384; // 16 KB
const MAX_SESSION_ID_LENGTH = 128;

export class EventService {
  /**
   * Validates and records an anonymous commerce event.
   * Enforces privacy, metadata limits, and store isolation.
   * Makes ZERO Gemini API calls.
   */
  async createEvent(input: CreateEventInput): Promise<CommerceEventResponse> {
    if (!input || typeof input !== 'object') {
      throw new AppError('Request body is required', 400);
    }

    const { sessionId, storeId, productId, eventType, metadata } = input;

    // 1. Validate sessionId
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new AppError('sessionId is required and must be a non-empty string', 400);
    }
    const cleanSessionId = sessionId.trim();
    if (cleanSessionId.length > MAX_SESSION_ID_LENGTH) {
      throw new AppError(`sessionId exceeds maximum length of ${MAX_SESSION_ID_LENGTH} characters`, 400);
    }

    // 2. Validate storeId
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required and must be a non-empty string', 400);
    }
    const cleanStoreId = storeId.trim();

    // Verify store exists in database
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });
    if (!store) {
      throw new AppError(`Store not found with id: ${cleanStoreId}`, 404);
    }

    // 3. Validate eventType
    if (!eventType || typeof eventType !== 'string') {
      throw new AppError('eventType is required and must be a valid CommerceEventType', 400);
    }
    const cleanEventType = eventType.trim() as CommerceEventType;
    if (!VALID_COMMERCE_EVENT_TYPES.includes(cleanEventType)) {
      throw new AppError(
        `Invalid eventType: "${eventType}". Allowed values: ${VALID_COMMERCE_EVENT_TYPES.join(', ')}`,
        400
      );
    }

    // 4. Validate productId and Store Isolation
    let cleanProductId: string | null = null;
    if (productId !== undefined && productId !== null && productId !== '') {
      if (typeof productId !== 'string' || !productId.trim()) {
        throw new AppError('productId must be a valid non-empty string if provided', 400);
      }
      cleanProductId = productId.trim();

      // Check product exists in database
      const product = await prisma.product.findUnique({
        where: { id: cleanProductId },
      });
      if (!product) {
        throw new AppError(`Product not found with id: ${cleanProductId}`, 404);
      }

      // STRICT STORE ISOLATION: Product must belong to the specified store
      if (product.storeId !== cleanStoreId) {
        throw new AppError(
          `Security violation: Product "${cleanProductId}" does not belong to store "${cleanStoreId}"`,
          400
        );
      }
    }

    // 5. Validate metadata
    let cleanMetadata: Prisma.InputJsonValue | undefined = undefined;
    if (metadata !== undefined && metadata !== null) {
      if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        throw new AppError('metadata must be a valid JSON object', 400);
      }

      // Check metadata stringified size limit
      let serialized: string;
      try {
        serialized = JSON.stringify(metadata);
      } catch (err) {
        throw new AppError('metadata must be serializable JSON', 400);
      }

      if (serialized.length > MAX_METADATA_SIZE_BYTES) {
        throw new AppError(`metadata size exceeds limit of ${MAX_METADATA_SIZE_BYTES} bytes`, 400);
      }

      // Check forbidden sensitive/merchant fields
      this.scanForForbiddenKeys(metadata);

      cleanMetadata = metadata as Prisma.InputJsonValue;
    }

    // 6. Persist event to database
    const savedEvent = await prisma.commerceEvent.create({
      data: {
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        productId: cleanProductId,
        eventType: cleanEventType,
        metadata: cleanMetadata,
      },
    });

    return {
      id: savedEvent.id,
      sessionId: savedEvent.sessionId,
      storeId: savedEvent.storeId,
      productId: savedEvent.productId,
      eventType: savedEvent.eventType,
      metadata: savedEvent.metadata as Record<string, any> | null,
      createdAt: savedEvent.createdAt,
    };
  }

  /**
   * Recursively checks for forbidden sensitive fields in metadata.
   */
  private scanForForbiddenKeys(obj: any, depth = 0): void {
    if (!obj || typeof obj !== 'object' || depth > 5) return;

    for (const key of Object.keys(obj)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (FORBIDDEN_METADATA_KEYS.has(normalizedKey)) {
        throw new AppError(`Security violation: Forbidden field "${key}" detected in event metadata`, 400);
      }

      const val = obj[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        this.scanForForbiddenKeys(val, depth + 1);
      }
    }
  }
}

export const eventService = new EventService();
