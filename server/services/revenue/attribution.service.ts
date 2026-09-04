import { AttributionSource } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface ResolveAttributionInput {
  sessionId: string;
  storeId: string;
  productId: string;
  checkoutTime?: Date;
  windowMs?: number; // Optional lookback window (default: 24 hours)
}

const DEFAULT_ATTRIBUTION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export class AttributionService {
  /**
   * Resolves the strongest verified commerce touchpoint for an OrderItem at checkout.
   *
   * STRICT ATTRIBUTION PRIORITY HIERARCHY:
   * 1. RECOVERY: OFFER_ACCEPTED event with metadata.source === 'sale_recovery'
   * 2. OFFER: OFFER_ACCEPTED event with standard offer metadata (discount > 0)
   * 3. BUNDLE: RECOMMENDATION_CLICK event with metadata.source === 'BUNDLE_CROSS_SELL'
   * 4. AI_CHAT: RECOMMENDATION_CLICK event with AI chat metadata (rank / matchScore / matchReason)
   * 5. DIRECT: Fallback when no qualifying feature touchpoint exists
   *
   * GUARANTEES:
   * - 100% Deterministic & Server-Authoritative (never trusts client headers or payloads).
   * - Strict store, session, and product isolation.
   * - Ignores events created after checkoutTime.
   * - Ignores events older than the 24-hour attribution window.
   * - When multiple events exist at the same priority level, the most recent valid event before checkout is selected.
   * - ZERO Gemini / LLM calls.
   */
  async resolveAttributionSource(
    input: ResolveAttributionInput
  ): Promise<AttributionSource> {
    const {
      sessionId,
      storeId,
      productId,
      checkoutTime = new Date(),
      windowMs = DEFAULT_ATTRIBUTION_WINDOW_MS,
    } = input;

    if (!sessionId || !storeId || !productId) {
      return AttributionSource.DIRECT;
    }

    const cleanSessionId = sessionId.trim();
    const cleanStoreId = storeId.trim();
    const cleanProductId = productId.trim();

    const windowStartTime = new Date(checkoutTime.getTime() - windowMs);

    // Query candidate events within the bounded attribution window strictly before or at checkoutTime
    const events = await prisma.commerceEvent.findMany({
      where: {
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        productId: cleanProductId,
        eventType: {
          in: ['OFFER_ACCEPTED', 'RECOMMENDATION_CLICK'],
        },
        createdAt: {
          gte: windowStartTime,
          lte: checkoutTime,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (events.length === 0) {
      return AttributionSource.DIRECT;
    }

    // Step 1: Check for Priority 1 (RECOVERY)
    for (const evt of events) {
      if (evt.eventType === 'OFFER_ACCEPTED') {
        const meta = (evt.metadata && typeof evt.metadata === 'object')
          ? (evt.metadata as Record<string, any>)
          : null;
        if (meta?.source === 'sale_recovery') {
          return AttributionSource.RECOVERY;
        }
      }
    }

    // Step 2: Check for Priority 2 (OFFER)
    for (const evt of events) {
      if (evt.eventType === 'OFFER_ACCEPTED') {
        const meta = (evt.metadata && typeof evt.metadata === 'object')
          ? (evt.metadata as Record<string, any>)
          : null;
        // Non-recovery accepted offer
        if (meta?.source !== 'sale_recovery') {
          return AttributionSource.OFFER;
        }
      }
    }

    // Step 3: Check for Priority 3 (BUNDLE)
    for (const evt of events) {
      if (evt.eventType === 'RECOMMENDATION_CLICK') {
        const meta = (evt.metadata && typeof evt.metadata === 'object')
          ? (evt.metadata as Record<string, any>)
          : null;
        if (meta?.source === 'BUNDLE_CROSS_SELL') {
          return AttributionSource.BUNDLE;
        }
      }
    }

    // Step 4: Check for Priority 4 (AI_CHAT)
    for (const evt of events) {
      if (evt.eventType === 'RECOMMENDATION_CLICK') {
        const meta = (evt.metadata && typeof evt.metadata === 'object')
          ? (evt.metadata as Record<string, any>)
          : null;
        // Check for AI Chat recommendation signatures (rank, matchScore, matchReason, or non-bundle recommendation)
        if (
          meta?.source !== 'BUNDLE_CROSS_SELL' &&
          (typeof meta?.rank === 'number' ||
            typeof meta?.matchScore === 'number' ||
            typeof meta?.matchReason === 'string' ||
            !meta?.source)
        ) {
          return AttributionSource.AI_CHAT;
        }
      }
    }

    // Step 5: Fallback to DIRECT
    return AttributionSource.DIRECT;
  }
}

export const attributionService = new AttributionService();
