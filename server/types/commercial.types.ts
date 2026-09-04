import { BundleOpportunity } from './bundle.types';
import { ProductAlternativeItem } from './revenue.types';
import { ConversationState } from './recommendation.types';

export type HesitationType = 'PRICE' | 'VALUE' | 'UNCERTAINTY' | 'ABANDONMENT' | 'NONE';

export interface HesitationSignal {
  type: HesitationType;
  confidence: number;
  triggerPhrase?: string;
  rawText: string;
}

export type CommercialOfferType =
  | 'NO_OFFER'
  | 'BUNDLE_VALUE'
  | 'SMALL_DISCOUNT'
  | 'TARGETED_OFFER'
  | 'SALE_RECOVERY'
  | 'NON_PRICE_INCENTIVE';

export interface CommercialDecisionInput {
  storeId: string;
  sessionId: string;
  query?: string;
  productId?: string;
  conversationState?: ConversationState;
  cartProductIds?: string[];
  triggerEvent?: 'CHAT_QUERY' | 'EXIT_INTENT' | 'CART_VIEW' | 'DIRECT_REQUEST';
}

export interface CommercialOffer {
  type: CommercialOfferType;
  productId?: string;
  productName?: string;
  bundleId?: string;
  originalPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  finalPrice?: number;
  reason: string;
  explanation?: string;
  bundleOpportunity?: BundleOpportunity | null;
  recoveryAlternatives?: ProductAlternativeItem[];
  nonPriceIncentive?: string;
  expiresAt?: string;
  token?: string; // Server-authoritative cryptographic validation token
}

/**
 * Internal result (contains merchant-confidential metrics, NOT sent to customer).
 */
export interface CommercialDecisionResult {
  decision: CommercialOfferType;
  hesitation: HesitationSignal;
  offer: CommercialOffer;
  targetProductId?: string;
  purchaseProbability: number; // stripped for client
  costPrice?: number;          // stripped for client
  marginHeadroom?: number;     // stripped for client
  marginFloorProtected: boolean;
  fatigueSuppressed: boolean;
  explanation: string;
}

/**
 * Customer-Safe Response Payload (STRICT: zero costPrice, margin, or internal probability).
 */
export interface CustomerCommercialOfferResponse {
  decision: CommercialOfferType;
  hesitationType: HesitationType;
  offer: CommercialOffer;
  message: string;
}

export interface AcceptOfferInput {
  storeId: string;
  sessionId: string;
  productId: string;
  offerType: CommercialOfferType;
  discountPercent: number;
  token?: string;
}

export interface RejectOfferInput {
  storeId: string;
  sessionId: string;
  productId: string;
  offerType: CommercialOfferType;
  reason?: string;
}

export interface CommercialIntelligenceData {
  storeId: string;
  totalOffersPresented: number;
  totalOffersAccepted: number;
  totalOffersRejected: number;
  offerAcceptanceRate: number;
  estimatedMarginProtected: number;
  hesitationCounts: {
    price: number;
    value: number;
    uncertainty: number;
    abandonment: number;
  };
  offersByType: Record<CommercialOfferType, number>;
  topHesitationProducts: Array<{
    productId: string;
    productName: string;
    hesitationCount: number;
  }>;
}
