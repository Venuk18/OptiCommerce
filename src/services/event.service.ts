import { apiFetch } from './api.client';
import { TrackEventInput, CommerceEventData } from '../types';

const SESSION_STORAGE_KEY = 'opticommerce_session_id';

/**
 * Returns the persistent anonymous session ID stored in localStorage,
 * or generates and stores a new RFC4122 v4 compliant UUID if not found.
 * Contains ZERO personally identifiable information.
 */
export function getAnonymousSessionId(): string {
  try {
    const existingSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existingSessionId && typeof existingSessionId === 'string' && existingSessionId.trim().length > 0) {
      return existingSessionId.trim();
    }

    // Generate random UUID
    let newSessionId: string;
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      newSessionId = crypto.randomUUID();
    } else {
      // Fallback RFC4122 v4 generator
      newSessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
    return newSessionId;
  } catch (e) {
    // If localStorage is blocked or throws in sandbox, generate in-memory identifier
    return 'anon-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }
}

export const eventService = {
  /**
   * Tracks an anonymous commerce event.
   * NON-BLOCKING: This function will NEVER throw an unhandled error to caller,
   * guaranteeing that tracking failures never disrupt the customer shopping experience.
   */
  async trackEvent(input: TrackEventInput): Promise<CommerceEventData | null> {
    try {
      if (!input || !input.storeId || !input.eventType) {
        return null;
      }

      const sessionId = getAnonymousSessionId();

      const payload = {
        sessionId,
        storeId: input.storeId,
        eventType: input.eventType,
        productId: input.productId || null,
        metadata: input.metadata || null,
      };

      const response = await apiFetch<CommerceEventData>('/api/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return response;
    } catch (error) {
      // Non-blocking fire-and-forget logging: do not re-throw to UI
      console.warn('[Event Tracker Notice] Non-blocking event tracking notice:', error);
      return null;
    }
  },
};
