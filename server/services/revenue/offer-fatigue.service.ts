export interface SessionOfferRecord {
  productId: string;
  storeId: string;
  offerType: string;
  discountPercent?: number;
  status: 'PRESENTED' | 'ACCEPTED' | 'REJECTED';
  timestamp: number;
}

export class OfferFatigueService {
  // In-memory session offer tracking keyed by `${sessionId}:${storeId}`
  private sessionOffers: Map<string, SessionOfferRecord[]> = new Map();

  // Maximum allowed discount offers per customer session to prevent fatigue / margin erosion
  private readonly MAX_DISCOUNT_OFFERS_PER_SESSION = 2;

  // Cooldown period in ms before offering another discount on the same product (5 minutes)
  private readonly SAME_PRODUCT_COOLDOWN_MS = 5 * 60 * 1000;

  private getKey(sessionId: string, storeId: string): string {
    return `${sessionId.trim()}:${storeId.trim()}`;
  }

  /**
   * Checks whether a new discount offer should be suppressed due to fatigue,
   * previous rejection, or frequency limits.
   */
  isSuppressed(
    sessionId: string,
    storeId: string,
    productId?: string
  ): { suppressed: boolean; reason?: string } {
    const key = this.getKey(sessionId, storeId);
    const history = this.sessionOffers.get(key) || [];

    // Rule 1: Limit total active discount offers per session
    const discountOffersCount = history.filter(
      (h) => h.offerType === 'SMALL_DISCOUNT' || h.offerType === 'TARGETED_OFFER'
    ).length;

    if (discountOffersCount >= this.MAX_DISCOUNT_OFFERS_PER_SESSION) {
      return {
        suppressed: true,
        reason: 'Session discount frequency limit reached; preserving margin.',
      };
    }

    if (!productId) {
      return { suppressed: false };
    }

    // Rule 2: Check product-specific history
    const productRecords = history.filter((h) => h.productId === productId);

    for (const record of productRecords) {
      // If customer previously rejected an offer on this product, do NOT haggle or re-offer discount
      if (record.status === 'REJECTED') {
        return {
          suppressed: true,
          reason: 'Customer previously declined offer for this item; avoiding repetitive offers.',
        };
      }

      // If customer already accepted an offer on this product, do not offer again
      if (record.status === 'ACCEPTED') {
        return {
          suppressed: true,
          reason: 'Customer has already accepted an offer for this product.',
        };
      }

      // If presented recently within cooldown window
      if (Date.now() - record.timestamp < this.SAME_PRODUCT_COOLDOWN_MS) {
        return {
          suppressed: true,
          reason: 'Offer recently presented for this product; cooling down.',
        };
      }
    }

    return { suppressed: false };
  }

  /**
   * Records that an offer was presented to the customer.
   */
  recordOfferPresented(
    sessionId: string,
    storeId: string,
    productId: string,
    offerType: string,
    discountPercent?: number
  ): void {
    const key = this.getKey(sessionId, storeId);
    const history = this.sessionOffers.get(key) || [];

    history.push({
      productId,
      storeId,
      offerType,
      discountPercent,
      status: 'PRESENTED',
      timestamp: Date.now(),
    });

    this.sessionOffers.set(key, history);
  }

  /**
   * Updates an offer status to ACCEPTED.
   */
  recordOfferAccepted(
    sessionId: string,
    storeId: string,
    productId: string
  ): void {
    const key = this.getKey(sessionId, storeId);
    const history = this.sessionOffers.get(key) || [];

    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].productId === productId) {
        history[i].status = 'ACCEPTED';
        break;
      }
    }
  }

  /**
   * Updates an offer status to REJECTED.
   */
  recordOfferRejected(
    sessionId: string,
    storeId: string,
    productId: string
  ): void {
    const key = this.getKey(sessionId, storeId);
    const history = this.sessionOffers.get(key) || [];

    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].productId === productId) {
        history[i].status = 'REJECTED';
        break;
      }
    }
  }

  /**
   * Convenience method to check fatigue for verification/direct callers.
   */
  checkFatigue(
    sessionId: string,
    productId?: string,
    storeId: string = 'default-store'
  ): { suppressOffer: boolean; reason?: string } {
    const res = this.isSuppressed(sessionId, storeId, productId);
    return {
      suppressOffer: res.suppressed,
      reason: res.reason,
    };
  }

  /**
   * Convenience method to record an offer view.
   */
  recordOfferView(
    sessionId: string,
    productId: string,
    offerType: string = 'SMALL_DISCOUNT',
    discountPercent: number = 10,
    storeId: string = 'default-store'
  ): void {
    this.recordOfferPresented(sessionId, storeId, productId, offerType, discountPercent);
  }

  /**
   * Convenience method to record an offer rejection.
   */
  recordOfferRejection(
    sessionId: string,
    productId: string,
    offerType: string = 'SMALL_DISCOUNT',
    storeId: string = 'default-store'
  ): void {
    const key = this.getKey(sessionId, storeId);
    let history = this.sessionOffers.get(key);
    if (!history) {
      history = [];
      this.sessionOffers.set(key, history);
    }
    history.push({
      productId,
      storeId,
      offerType,
      status: 'REJECTED',
      timestamp: Date.now(),
    });
  }

  /**
   * Clears offer fatigue for testing or session reset.
   */
  clear(): void {
    this.sessionOffers.clear();
  }
}

export const offerFatigueService = new OfferFatigueService();
