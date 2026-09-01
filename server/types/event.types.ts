import { CommerceEventType } from '@prisma/client';

export { CommerceEventType };

export const VALID_COMMERCE_EVENT_TYPES: CommerceEventType[] = [
  CommerceEventType.SEARCH,
  CommerceEventType.RECOMMENDATION_VIEW,
  CommerceEventType.RECOMMENDATION_CLICK,
  CommerceEventType.PRODUCT_VIEW,
  CommerceEventType.ADD_TO_CART,
  CommerceEventType.REMOVE_FROM_CART,
  CommerceEventType.CHECKOUT_STARTED,
  CommerceEventType.OFFER_VIEW,
  CommerceEventType.OFFER_ACCEPTED,
  CommerceEventType.OFFER_REJECTED,
  CommerceEventType.PURCHASE,
];

export interface CreateEventInput {
  sessionId: string;
  storeId: string;
  productId?: string | null;
  eventType: CommerceEventType | string;
  metadata?: Record<string, any> | null;
}

export interface CommerceEventResponse {
  id: string;
  sessionId: string;
  storeId: string;
  productId: string | null;
  eventType: CommerceEventType;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}
