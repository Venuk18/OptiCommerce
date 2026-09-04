import { apiFetch } from './api.client';
import { CommercialOffer, CommercialOfferType } from '../types';
import { getAnonymousSessionId } from './event.service';

export interface EvaluateCommercialDecisionInput {
  storeId: string;
  sessionId?: string;
  query?: string;
  productId?: string;
  conversationState?: any;
  cartProductIds?: string[];
  triggerEvent?: 'CHAT_QUERY' | 'EXIT_INTENT' | 'CART_VIEW' | 'DIRECT_REQUEST';
}

export interface CustomerCommercialResponse {
  decision: CommercialOfferType;
  hesitationType: string;
  offer: CommercialOffer;
  message: string;
}

export interface AcceptCommercialOfferInput {
  storeId: string;
  productId: string;
  offerType: CommercialOfferType;
  discountPercent: number;
  token?: string;
  sessionId?: string;
}

export interface RejectCommercialOfferInput {
  storeId: string;
  productId: string;
  offerType: CommercialOfferType;
  reason?: string;
  sessionId?: string;
}

export interface CommercialIntelligenceReport {
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

export const commercialService = {
  /**
   * Evaluates customer session, intent, and hesitation to formulate an authorized commercial offer.
   */
  async evaluateDecision(
    input: EvaluateCommercialDecisionInput
  ): Promise<CustomerCommercialResponse> {
    const sessionId = input.sessionId || getAnonymousSessionId();
    return apiFetch<CustomerCommercialResponse>('/api/commercial/decision', {
      method: 'POST',
      body: JSON.stringify({ ...input, sessionId }),
    });
  },

  /**
   * Accepts a server-authorized commercial offer.
   */
  async acceptOffer(
    input: AcceptCommercialOfferInput
  ): Promise<{ success: boolean; productId: string; finalPrice: number; discountPercent: number; message: string }> {
    const sessionId = input.sessionId || getAnonymousSessionId();
    return apiFetch('/api/commercial/accept', {
      method: 'POST',
      body: JSON.stringify({ ...input, sessionId }),
    });
  },

  /**
   * Declines a commercial offer and requests non-discount recovery alternatives.
   */
  async rejectOffer(
    input: RejectCommercialOfferInput
  ): Promise<{ success: boolean; recoveryAlternatives: any[]; message: string }> {
    const sessionId = input.sessionId || getAnonymousSessionId();
    return apiFetch('/api/commercial/reject', {
      method: 'POST',
      body: JSON.stringify({ ...input, sessionId }),
    });
  },

  /**
   * Retrieves merchant commercial revenue intelligence and hesitation metrics.
   */
  async getCommercialIntelligence(
    storeId: string
  ): Promise<CommercialIntelligenceReport> {
    return apiFetch<CommercialIntelligenceReport>(`/api/commercial/intelligence/${storeId}`);
  },
};
