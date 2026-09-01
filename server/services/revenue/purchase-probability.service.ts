import { CommerceEvent, CommerceEventType } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/app.error';
import {
  PurchaseProbabilityRequest,
  PurchaseProbabilityResult,
  BehavioralSignal,
  ConfidenceLevel,
  SignalImpact,
} from '../../types/revenue.types';

// Baseline purchase probability for a completely cold-start session (no events)
const COLD_START_BASELINE_PROBABILITY = 0.05; // 5% base conversion likelihood
const MAX_SESSION_ID_LENGTH = 128;
const LOOKBACK_WINDOW_DAYS = 30;

// Base nominal signal weights (points on raw scale)
const BASE_EVENT_WEIGHTS: Record<CommerceEventType, number> = {
  SEARCH: 2.5,
  RECOMMENDATION_VIEW: 3.5,
  RECOMMENDATION_CLICK: 10.0,
  PRODUCT_VIEW: 14.0,
  ADD_TO_CART: 30.0,
  CHECKOUT_STARTED: 42.0,
  OFFER_VIEW: 6.0,
  OFFER_ACCEPTED: 38.0,
  OFFER_REJECTED: -12.0,
  REMOVE_FROM_CART: -22.0,
  PURCHASE: 50.0,
};

export class PurchaseProbabilityService {
  /**
   * Deterministically estimates purchase probability P(purchase | session, product, context)
   * using chronological CommerceEvent behavioral data.
   * STRICT ZERO GEMINI CALLS.
   */
  async estimatePurchaseProbability(
    input: PurchaseProbabilityRequest
  ): Promise<PurchaseProbabilityResult> {
    if (!input || typeof input !== 'object') {
      throw new AppError('Request body is required', 400);
    }

    const { sessionId, storeId, productId } = input;

    // 1. Input Validation
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new AppError('sessionId is required and must be a non-empty string', 400);
    }
    const cleanSessionId = sessionId.trim();
    if (cleanSessionId.length > MAX_SESSION_ID_LENGTH) {
      throw new AppError(`sessionId exceeds maximum length of ${MAX_SESSION_ID_LENGTH} characters`, 400);
    }

    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required and must be a non-empty string', 400);
    }
    const cleanStoreId = storeId.trim();

    if (!productId || typeof productId !== 'string' || !productId.trim()) {
      throw new AppError('productId is required and must be a non-empty string', 400);
    }
    const cleanProductId = productId.trim();

    // 2. Validate Store & Product Existence and Store Isolation
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });
    if (!store) {
      throw new AppError(`Store not found with id: ${cleanStoreId}`, 404);
    }

    const product = await prisma.product.findUnique({
      where: { id: cleanProductId },
    });
    if (!product) {
      throw new AppError(`Product not found with id: ${cleanProductId}`, 404);
    }

    // Strict store isolation check
    if (product.storeId !== cleanStoreId) {
      throw new AppError(
        `Security violation: Product "${cleanProductId}" does not belong to store "${cleanStoreId}"`,
        400
      );
    }

    // 3. Retrieve relevant chronological events in recent lookback window (30 days)
    const windowStart = new Date(Date.now() - LOOKBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const events = await prisma.commerceEvent.findMany({
      where: {
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        createdAt: { gte: windowStart },
        OR: [
          { productId: cleanProductId }, // Product-specific events for this product
          { productId: null },           // General session-level events (e.g. generic SEARCH)
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    // 4. Handle Cold Start (No behavioral evidence in session)
    if (!events || events.length === 0) {
      return {
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        productId: cleanProductId,
        purchaseProbability: COLD_START_BASELINE_PROBABILITY,
        score: Math.round(COLD_START_BASELINE_PROBABILITY * 100),
        confidence: 'LOW',
        signals: [
          {
            event: 'COLD_START',
            impact: 'low_positive',
            description: 'New session baseline with no prior interaction history',
          },
        ],
      };
    }

    // 5. Evaluate Behavioral Events with Recency and Diminishing Returns
    const now = Date.now();
    let netScore = 0;
    const eventCounts: Partial<Record<CommerceEventType, number>> = {};
    const seenEvents = new Set<CommerceEventType>();

    for (const event of events) {
      const type = event.eventType;
      const baseWeight = BASE_EVENT_WEIGHTS[type] ?? 0;
      const count = (eventCounts[type] || 0) + 1;
      eventCounts[type] = count;
      seenEvents.add(type);

      // Product Specificity Multiplier:
      // Product-specific events get full 1.0x weight.
      // Session-wide events without productId (like general SEARCH) get 0.6x weight.
      const specificityMultiplier = event.productId === cleanProductId ? 1.0 : 0.6;

      // Diminishing returns on repeated identical events:
      // 1st time: 1.0x, 2nd: 0.65x, 3rd: 0.45x, 4th+: 0.25x
      const repetitionMultiplier =
        count === 1 ? 1.0 : count === 2 ? 0.65 : count === 3 ? 0.45 : 0.25;

      // Recency Decay Multiplier (half-life step decay)
      const ageHours = (now - event.createdAt.getTime()) / (1000 * 60 * 60);
      const recencyMultiplier = this.calculateRecencyMultiplier(ageHours);

      // Effective weighted contribution for this event
      const effectiveEventContribution =
        baseWeight * specificityMultiplier * repetitionMultiplier * recencyMultiplier;

      netScore += effectiveEventContribution;
    }

    // 6. Evaluate Chronological Funnel Sequence Progression
    // A sequence Discovery -> Interest -> Intent -> Conversion Attempt indicates deliberate buying intent
    const progressionBonus = this.calculateSequenceProgressionBonus(events, cleanProductId);
    netScore += progressionBonus;

    // 7. Score Calibration & Normalization (Convert raw points into 0..1 probability)
    // Raw score calibration mapping:
    // Raw 0 -> ~0.05 baseline
    // Raw 14 (view only) -> ~0.18
    // Raw 44 (view + cart) -> ~0.55
    // Raw 85 (view + cart + checkout) -> ~0.82
    // Raw 120+ -> ~0.93 - 0.98
    const purchaseProbability = this.calibrateProbability(netScore);
    const score = Math.round(purchaseProbability * 100);

    // 8. Confidence Level Calculation based on evidence volume and funnel depth
    const confidence = this.calculateConfidence(events, cleanProductId, eventCounts);

    // 9. Generate Machine-Readable Explanations / Signals
    const signals = this.generateSignalsList(eventCounts, progressionBonus);

    return {
      sessionId: cleanSessionId,
      storeId: cleanStoreId,
      productId: cleanProductId,
      purchaseProbability: Number(purchaseProbability.toFixed(2)),
      score,
      confidence,
      signals,
    };
  }

  /**
   * Deterministic recency decay multiplier based on elapsed time:
   * - < 2 hours: 1.0 (immediate active intent)
   * - < 24 hours: 0.90 (today)
   * - < 72 hours: 0.75 (recent 3 days)
   * - < 7 days: 0.55 (this week)
   * - < 14 days: 0.35 (two weeks ago)
   * - <= 30 days: 0.20 (older history)
   */
  private calculateRecencyMultiplier(ageHours: number): number {
    if (ageHours <= 2) return 1.0;
    if (ageHours <= 24) return 0.90;
    if (ageHours <= 72) return 0.75;
    if (ageHours <= 168) return 0.55;
    if (ageHours <= 336) return 0.35;
    return 0.20;
  }

  /**
   * Rewards meaningful chronological funnel progressions for the requested product.
   */
  private calculateSequenceProgressionBonus(
    events: CommerceEvent[],
    targetProductId: string
  ): number {
    let bonus = 0;
    let hasDiscovery = false;
    let hasInterest = false;
    let hasCart = false;
    let hasCheckout = false;

    for (const e of events) {
      if (e.eventType === 'SEARCH' || e.eventType === 'RECOMMENDATION_VIEW') {
        hasDiscovery = true;
      }
      if (
        (e.eventType === 'RECOMMENDATION_CLICK' || e.eventType === 'PRODUCT_VIEW') &&
        e.productId === targetProductId
      ) {
        if (hasDiscovery) {
          bonus += 4; // Discovery -> Interest progression
        }
        hasInterest = true;
      }
      if (e.eventType === 'ADD_TO_CART' && e.productId === targetProductId) {
        if (hasInterest) {
          bonus += 8; // Interest -> Cart progression
        }
        hasCart = true;
      }
      if (
        (e.eventType === 'CHECKOUT_STARTED' || e.eventType === 'OFFER_ACCEPTED') &&
        (e.productId === targetProductId || e.productId === null)
      ) {
        if (hasCart) {
          bonus += 12; // Cart -> Checkout progression
        }
        hasCheckout = true;
      }
    }

    return Math.min(bonus, 24); // Cap max progression bonus at 24 points
  }

  /**
   * Calibrates raw behavioral score to a smooth probability in [0.02, 0.98]
   * Anchored smoothly at cold start baseline for score <= 0.
   */
  private calibrateProbability(rawScore: number): number {
    if (rawScore <= 0) {
      // Bounded floor for negative behaviors (e.g. cart removal + offer rejection)
      const floor = Math.max(0.02, COLD_START_BASELINE_PROBABILITY + rawScore * 0.001);
      return Math.min(COLD_START_BASELINE_PROBABILITY, floor);
    }

    // Sigmoidal growth curve calibrated for e-commerce intent
    // S(x) = 1 / (1 + exp(-k * (x - x0)))
    const k = 0.038;
    const x0 = 38.0;
    const sigmoid = 1 / (1 + Math.exp(-k * (rawScore - x0)));

    // Scale so rawScore=0 maps smoothly near COLD_START_BASELINE_PROBABILITY (0.05) and asymptotes to 0.98
    const calibrated = Math.min(0.98, Math.max(COLD_START_BASELINE_PROBABILITY, sigmoid));
    return calibrated;
  }

  /**
   * Evaluates evidence quality and behavioral depth to assign confidence level:
   * LOW: minimal evidence (only 1-2 discovery events or cold start)
   * MEDIUM: moderate evidence (views, clicks, or multiple interactions)
   * HIGH: strong clear evidence (deep funnel events like ADD_TO_CART, CHECKOUT, or rich multi-touch session)
   */
  private calculateConfidence(
    events: CommerceEvent[],
    targetProductId: string,
    eventCounts: Partial<Record<CommerceEventType, number>>
  ): ConfidenceLevel {
    const totalEvents = events.length;
    const productEvents = events.filter((e) => e.productId === targetProductId).length;

    const hasHighIntentAction =
      (eventCounts.ADD_TO_CART || 0) > 0 ||
      (eventCounts.CHECKOUT_STARTED || 0) > 0 ||
      (eventCounts.OFFER_ACCEPTED || 0) > 0 ||
      (eventCounts.PURCHASE || 0) > 0;

    if (hasHighIntentAction && productEvents >= 2) {
      return 'HIGH';
    }

    if (productEvents >= 3 || totalEvents >= 5 || (hasHighIntentAction && totalEvents >= 1)) {
      return 'MEDIUM';
    }

    if (totalEvents >= 2 && productEvents >= 1) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Generates a clean, machine-readable array of behavioral signals.
   */
  private generateSignalsList(
    eventCounts: Partial<Record<CommerceEventType, number>>,
    progressionBonus: number
  ): BehavioralSignal[] {
    const signals: BehavioralSignal[] = [];

    const formatImpact = (type: CommerceEventType): SignalImpact => {
      switch (type) {
        case 'PURCHASE':
        case 'CHECKOUT_STARTED':
        case 'OFFER_ACCEPTED':
          return 'very_strong_positive';
        case 'ADD_TO_CART':
          return 'strong_positive';
        case 'PRODUCT_VIEW':
        case 'RECOMMENDATION_CLICK':
          return 'positive';
        case 'SEARCH':
        case 'RECOMMENDATION_VIEW':
        case 'OFFER_VIEW':
          return 'low_positive';
        case 'REMOVE_FROM_CART':
          return 'strong_negative';
        case 'OFFER_REJECTED':
          return 'negative';
        default:
          return 'low_positive';
      }
    };

    // Add prominent event signals present
    const eventOrder: CommerceEventType[] = [
      'PURCHASE',
      'CHECKOUT_STARTED',
      'ADD_TO_CART',
      'OFFER_ACCEPTED',
      'PRODUCT_VIEW',
      'RECOMMENDATION_CLICK',
      'RECOMMENDATION_VIEW',
      'SEARCH',
      'OFFER_VIEW',
      'REMOVE_FROM_CART',
      'OFFER_REJECTED',
    ];

    for (const type of eventOrder) {
      const count = eventCounts[type];
      if (count && count > 0) {
        signals.push({
          event: type,
          impact: formatImpact(type),
          count,
        });
      }
    }

    if (progressionBonus >= 8) {
      signals.push({
        event: 'FUNNEL_PROGRESSION',
        impact: 'strong_positive',
        description: 'Demonstrated chronological multi-stage shopping progression',
      });
    }

    return signals;
  }
}

export const purchaseProbabilityService = new PurchaseProbabilityService();
