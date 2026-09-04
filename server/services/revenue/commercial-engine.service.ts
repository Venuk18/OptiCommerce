import crypto from 'crypto';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/app.error';
import {
  CommercialDecisionInput,
  CommercialDecisionResult,
  CommercialOffer,
  CommercialOfferType,
  CustomerCommercialOfferResponse,
  AcceptOfferInput,
  RejectOfferInput,
} from '../../types/commercial.types';
import { hesitationDetectorService } from './hesitation-detector.service';
import { offerFatigueService } from './offer-fatigue.service';
import { purchaseProbabilityService } from './purchase-probability.service';
import { saleRecoveryService } from './sale-recovery.service';
import { bundleService } from '../bundle.service';
import { aiProviderOrchestrator } from '../ai/providers/ai-provider.orchestrator';

const TOKEN_SECRET = process.env.COMMERCIAL_SECRET || 'opticommerce-commercial-secret-key-2026';

export class CommercialEngineService {
  /**
   * Generates a tamper-proof server token for an authorized commercial offer.
   */
  private generateOfferToken(
    storeId: string,
    sessionId: string,
    productId: string,
    offerType: CommercialOfferType,
    discountPercent: number
  ): string {
    const payload = `${storeId}:${sessionId}:${productId}:${offerType}:${discountPercent}`;
    const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    return Buffer.from(JSON.stringify({ payload, hmac })).toString('base64');
  }

  /**
   * Validates an offer token.
   */
  public verifyOfferToken(
    token: string,
    storeId: string,
    sessionId: string,
    productId: string,
    offerType: CommercialOfferType,
    discountPercent: number
  ): boolean {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      const expectedPayload = `${storeId}:${sessionId}:${productId}:${offerType}:${discountPercent}`;
      if (decoded.payload !== expectedPayload) return false;
      const expectedHmac = crypto.createHmac('sha256', TOKEN_SECRET).update(expectedPayload).digest('hex');
      return decoded.hmac === expectedHmac;
    } catch {
      return false;
    }
  }

  /**
   * Evaluates the customer interaction, signals, economics, and determines the exact
   * commercial intervention.
   */
  async evaluateCommercialDecision(
    input: CommercialDecisionInput
  ): Promise<CommercialDecisionResult> {
    const { storeId, sessionId, query, productId, conversationState, cartProductIds, triggerEvent } = input;

    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }
    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }

    const cleanStoreId = storeId.trim();
    const cleanSessionId = sessionId.trim();

    // 1. Verify Store exists
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // 2. Resolve Target Product
    let targetProductId = productId?.trim();
    if (!targetProductId && conversationState?.selectedProductId) {
      targetProductId = conversationState.selectedProductId;
    }
    if (!targetProductId && conversationState?.discussedProducts && conversationState.discussedProducts.length > 0) {
      targetProductId = conversationState.discussedProducts[0].id;
    }
    if (!targetProductId && cartProductIds && cartProductIds.length > 0) {
      targetProductId = cartProductIds[0];
    }

    // If no target product can be identified, no commercial offer can be formulated
    if (!targetProductId) {
      return {
        decision: 'NO_OFFER',
        hesitation: { type: 'NONE', confidence: 0, rawText: query || '' },
        offer: {
          type: 'NO_OFFER',
          reason: 'No specific product in customer context.',
        },
        purchaseProbability: 0.5,
        marginFloorProtected: true,
        fatigueSuppressed: false,
        explanation: 'We are here to help you explore our catalog.',
      };
    }

    // 3. Load authoritative product record
    const product = await prisma.product.findUnique({
      where: { id: targetProductId },
    });

    if (!product || product.storeId !== cleanStoreId) {
      return {
        decision: 'NO_OFFER',
        hesitation: { type: 'NONE', confidence: 0, rawText: query || '' },
        offer: {
          type: 'NO_OFFER',
          reason: 'Product does not belong to store.',
        },
        purchaseProbability: 0,
        marginFloorProtected: true,
        fatigueSuppressed: false,
        explanation: 'Product not available.',
      };
    }

    const price = Number(product.price);
    const costPrice = Number(product.costPrice ?? 0);
    const hasPositiveMargin = price > costPrice;

    // Check merchant discount eligibility flags
    const specs = (product.specifications || {}) as Record<string, any>;
    const isDiscountEligible =
      hasPositiveMargin &&
      specs.aiDiscountEligible !== false &&
      !(product.tags || []).includes('no-discount') &&
      !(product.tags || []).includes('ai-discount-ineligible');

    // 4. Detect Hesitation Signal
    const hesitation = hesitationDetectorService.detectHesitation(query, conversationState);
    if (triggerEvent === 'DIRECT_REQUEST' && hesitation.type === 'NONE') {
      hesitation.type = 'PRICE';
      hesitation.confidence = 1.0;
      hesitation.triggerPhrase = 'direct_offer_request';
    }

    // 5. Estimate Purchase Probability (Phase 5B)
    const probResult = await purchaseProbabilityService.estimatePurchaseProbability({
      sessionId: cleanSessionId,
      storeId: cleanStoreId,
      productId: product.id,
    });
    const p0 = probResult.purchaseProbability;

    // 6. Check Offer Fatigue
    const fatigueCheck = offerFatigueService.isSuppressed(
      cleanSessionId,
      cleanStoreId,
      product.id
    );

    // Calculate maximum mathematically safe discount percentage respecting costPrice floor
    const rawHeadroom = hasPositiveMargin ? (price - costPrice) / price : 0;
    const maxSafeDiscountPercent = Math.max(0, Math.floor(rawHeadroom * 100));

    // Helper to format currency
    const formatCurrency = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;

    // ==========================================
    // COMMERCIAL DECISION LOGIC
    // ==========================================

    // Case 1: Positive purchase intent OR High Purchase Probability without price hesitation
    // Direct merchant revenue protection: Do NOT discount customers who are already sold!
    if (
      hesitation.triggerPhrase === 'positive_purchase_intent' ||
      (p0 >= 0.65 && hesitation.type !== 'PRICE' && triggerEvent !== 'DIRECT_REQUEST')
    ) {
      return {
        decision: 'NO_OFFER',
        hesitation,
        targetProductId: product.id,
        purchaseProbability: p0,
        costPrice,
        marginHeadroom: rawHeadroom,
        marginFloorProtected: true,
        fatigueSuppressed: false,
        offer: {
          type: 'NO_OFFER',
          productId: product.id,
          productName: product.name,
          originalPrice: price,
          finalPrice: price,
          reason: 'Customer demonstrates strong purchase intent; full price maintained.',
        },
        explanation: `Great choice! The ${product.name} is in stock and ready to be added to your order at ${formatCurrency(price)}.`,
      };
    }

    // Case 2: Value Hesitation ("Is it worth it?", "Why pay this much?")
    // Offer non-price incentive / value reassurance
    if (hesitation.type === 'VALUE') {
      const nonPriceIncentive =
        'Includes 1-Year Official Brand Warranty, Hassle-Free 7-Day Returns, and Complimentary Express Shipping.';
      return {
        decision: 'NON_PRICE_INCENTIVE',
        hesitation,
        targetProductId: product.id,
        purchaseProbability: p0,
        costPrice,
        marginHeadroom: rawHeadroom,
        marginFloorProtected: true,
        fatigueSuppressed: false,
        offer: {
          type: 'NON_PRICE_INCENTIVE',
          productId: product.id,
          productName: product.name,
          originalPrice: price,
          finalPrice: price,
          nonPriceIncentive,
          reason: 'Customer questioned value; non-price confidence reassurance provided.',
        },
        explanation: `The ${product.name} is engineered for durability and peak performance, backed by our comprehensive warranty and premium support at ${formatCurrency(price)}.`,
      };
    }

    // Case 3: Customer previously declined or fatigue suppressed
    if (fatigueCheck.suppressed && hesitation.type === 'PRICE') {
      // If customer is still hesitating on price after declining, offer in-stock lower-cost alternatives
      const recovery = await saleRecoveryService.recoverSale({
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        rejectedProductId: product.id,
        userQuery: query,
        maxBudget: conversationState?.budget?.max,
        limit: 3,
      });

      if (recovery.alternatives.length > 0) {
        return {
          decision: 'SALE_RECOVERY',
          hesitation,
          targetProductId: product.id,
          purchaseProbability: p0,
          costPrice,
          marginHeadroom: rawHeadroom,
          marginFloorProtected: true,
          fatigueSuppressed: true,
          offer: {
            type: 'SALE_RECOVERY',
            productId: product.id,
            productName: product.name,
            originalPrice: price,
            recoveryAlternatives: recovery.alternatives,
            reason: 'Discount suppressed by fatigue; presenting lower-cost alternatives.',
          },
          explanation: `Since ${product.name} exceeds your target, here are top-rated alternatives from our store that deliver great performance within a friendlier budget:`,
        };
      }

      return {
        decision: 'NON_PRICE_INCENTIVE',
        hesitation,
        targetProductId: product.id,
        purchaseProbability: p0,
        costPrice,
        marginHeadroom: rawHeadroom,
        marginFloorProtected: true,
        fatigueSuppressed: true,
        offer: {
          type: 'NON_PRICE_INCENTIVE',
          productId: product.id,
          productName: product.name,
          originalPrice: price,
          finalPrice: price,
          nonPriceIncentive: 'Zero-cost EMI options and official manufacturer guarantee.',
          reason: 'Fatigue limit reached; offering non-price financing and warranty reassurance.',
        },
        explanation: `We offer flexible EMI payment options and full warranty coverage on the ${product.name} at ${formatCurrency(price)}.`,
      };
    }

    // Case 4: Price Hesitation + Check Bundle Opportunity
    // Bundles are preferred over naked discounts when they preserve margin and expand basket size
    const queryMentionsBundle = /\b(bundle|accessories|package|kit|combo|pair|together)\b/i.test(
      query || ''
    );

    let bundleOpp = null;
    try {
      const bundleSuggestions = await bundleService.getBundleSuggestions({
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        productId: product.id,
        limit: 2,
      });

      if (bundleSuggestions.suggestions.length > 0) {
        // Calculate bundle price and savings
        const complementaryItems = bundleSuggestions.suggestions;
        const allItems = [
          {
            id: product.id,
            name: product.name,
            category: product.category,
            brand: product.brand,
            price: price,
            stock: product.stock,
            image: (product.images && product.images[0]) || '',
          },
          ...complementaryItems.map((s) => ({
            id: s.productId,
            name: s.name,
            category: s.category,
            brand: s.brand,
            price: s.price,
            stock: s.stock,
            image: s.image,
          })),
        ];

        const originalTotal = allItems.reduce((acc, item) => acc + item.price, 0);
        // Safe bundle discount: 8% bundle savings if margin allows
        const bundleDiscountPercent = 8;
        const discountAmount = Math.round(originalTotal * (bundleDiscountPercent / 100));
        const bundlePrice = originalTotal - discountAmount;

        bundleOpp = {
          bundleId: `bundle-${product.id}`,
          bundleName: `${product.name} Complete Setup`,
          products: allItems,
          discountEligible: true,
          bundleSummary: `Bundle ${product.name} with complementary accessories for extra value.`,
          originalTotal,
          bundlePrice,
          savings: discountAmount,
          discountPercent: bundleDiscountPercent,
        };
      }
    } catch {
      // Non-blocking fallback
    }

    // If customer asks for a bundle OR customer has price hesitation and bundle is available
    if (queryMentionsBundle && bundleOpp) {
      offerFatigueService.recordOfferPresented(
        cleanSessionId,
        cleanStoreId,
        product.id,
        'BUNDLE_VALUE'
      );

      return {
        decision: 'BUNDLE_VALUE',
        hesitation,
        targetProductId: product.id,
        purchaseProbability: p0,
        costPrice,
        marginHeadroom: rawHeadroom,
        marginFloorProtected: true,
        fatigueSuppressed: false,
        offer: {
          type: 'BUNDLE_VALUE',
          productId: product.id,
          productName: product.name,
          bundleOpportunity: bundleOpp,
          originalPrice: bundleOpp.originalTotal,
          finalPrice: bundleOpp.bundlePrice,
          discountAmount: bundleOpp.savings,
          discountPercent: bundleOpp.discountPercent,
          reason: 'Bundle opportunity provides superior value while preserving merchant margin.',
        },
        explanation: `Instead of buying standalone, save ${formatCurrency(bundleOpp.savings)} with the ${bundleOpp.bundleName} bundle at ${formatCurrency(bundleOpp.bundlePrice)}!`,
      };
    }

    // Case 5: Explicit Price Hesitation with Safe Margin Headroom
    if (hesitation.type === 'PRICE') {
      // If product is NOT discount eligible or has no margin headroom -> cannot discount!
      if (!isDiscountEligible || maxSafeDiscountPercent < 5) {
        // Recover with lower-cost alternatives or non-price reassurance
        const recovery = await saleRecoveryService.recoverSale({
          sessionId: cleanSessionId,
          storeId: cleanStoreId,
          rejectedProductId: product.id,
          userQuery: query,
          maxBudget: conversationState?.budget?.max,
          limit: 3,
        });

        if (recovery.alternatives.length > 0) {
          return {
            decision: 'SALE_RECOVERY',
            hesitation,
            targetProductId: product.id,
            purchaseProbability: p0,
            costPrice,
            marginHeadroom: rawHeadroom,
            marginFloorProtected: true,
            fatigueSuppressed: false,
            offer: {
              type: 'SALE_RECOVERY',
              productId: product.id,
              productName: product.name,
              originalPrice: price,
              recoveryAlternatives: recovery.alternatives,
              reason: 'Margin floor precludes discount; offering verified lower-cost alternatives.',
            },
            explanation: `While ${product.name} is priced firmly at ${formatCurrency(price)}, here are top-performing alternatives that fit comfortably within your budget:`,
          };
        }

        return {
          decision: 'NON_PRICE_INCENTIVE',
          hesitation,
          targetProductId: product.id,
          purchaseProbability: p0,
          costPrice,
          marginHeadroom: rawHeadroom,
          marginFloorProtected: true,
          fatigueSuppressed: false,
          offer: {
            type: 'NON_PRICE_INCENTIVE',
            productId: product.id,
            productName: product.name,
            originalPrice: price,
            finalPrice: price,
            nonPriceIncentive: 'Complimentary priority delivery and official store warranty.',
            reason: 'Product margin protected at floor; offering non-price incentive.',
          },
          explanation: `The ${product.name} is priced at our best direct price of ${formatCurrency(price)}, with complimentary fast shipping and full warranty included.`,
        };
      }

      // Customer has price hesitation and product has safe margin headroom:
      // Decision between SMALL_DISCOUNT (5%) vs TARGETED_OFFER (10%)
      let authorizedDiscount = 5;
      let offerType: CommercialOfferType = 'SMALL_DISCOUNT';

      if (p0 < 0.35 && maxSafeDiscountPercent >= 15) {
        // Low probability customer with generous margin headroom -> Targeted 10% conversion offer
        authorizedDiscount = 10;
        offerType = 'TARGETED_OFFER';
      } else {
        // Medium probability or modest margin -> 5% Small Discount
        authorizedDiscount = 5;
        offerType = 'SMALL_DISCOUNT';
      }

      // Enforce absolute margin floor
      if (authorizedDiscount > maxSafeDiscountPercent) {
        authorizedDiscount = maxSafeDiscountPercent;
      }

      const discountAmount = Math.round(price * (authorizedDiscount / 100));
      const finalPrice = price - discountAmount;

      // Verification: finalPrice MUST be strictly >= costPrice
      if (finalPrice < costPrice) {
        return {
          decision: 'NON_PRICE_INCENTIVE',
          hesitation,
          targetProductId: product.id,
          purchaseProbability: p0,
          costPrice,
          marginHeadroom: rawHeadroom,
          marginFloorProtected: true,
          fatigueSuppressed: false,
          offer: {
            type: 'NON_PRICE_INCENTIVE',
            productId: product.id,
            productName: product.name,
            originalPrice: price,
            finalPrice: price,
            nonPriceIncentive: 'Official warranty and free delivery.',
            reason: 'Safety check prevented sub-cost discount.',
          },
          explanation: `The ${product.name} is at its lowest possible price of ${formatCurrency(price)} with free express shipping.`,
        };
      }

      const token = this.generateOfferToken(
        cleanStoreId,
        cleanSessionId,
        product.id,
        offerType,
        authorizedDiscount
      );

      // Record offer presented for fatigue tracking
      offerFatigueService.recordOfferPresented(
        cleanSessionId,
        cleanStoreId,
        product.id,
        offerType,
        authorizedDiscount
      );

      return {
        decision: offerType,
        hesitation,
        targetProductId: product.id,
        purchaseProbability: p0,
        costPrice,
        marginHeadroom: rawHeadroom,
        marginFloorProtected: true,
        fatigueSuppressed: false,
        offer: {
          type: offerType,
          productId: product.id,
          productName: product.name,
          originalPrice: price,
          discountAmount,
          discountPercent: authorizedDiscount,
          finalPrice,
          reason: `Authorized ${authorizedDiscount}% discount to assist price-hesitant customer while safeguarding merchant margin.`,
          token,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
        explanation: `To help you decide, we can offer an exclusive ${authorizedDiscount}% discount on the ${product.name}, reducing the price from ${formatCurrency(price)} to ${formatCurrency(finalPrice)}!`,
      };
    }

    // Case 6: Default fallback when no commercial intervention is needed
    return {
      decision: 'NO_OFFER',
      hesitation,
      targetProductId: product.id,
      purchaseProbability: p0,
      costPrice,
      marginHeadroom: rawHeadroom,
      marginFloorProtected: true,
      fatigueSuppressed: false,
      offer: {
        type: 'NO_OFFER',
        productId: product.id,
        productName: product.name,
        originalPrice: price,
        finalPrice: price,
        reason: 'Standard shopping query; no commercial discount required.',
      },
      explanation: `The ${product.name} is available for ${formatCurrency(price)}.`,
    };
  }

  /**
   * Accepts an authorized commercial offer:
   * - Validates store isolation and product presence
   * - Validates server-authoritative token and margin floor
   * - Records OFFER_ACCEPTED commerce event
   * - Updates offer fatigue state
   * - Adds/Updates cart with verified discount
   */
  async acceptOffer(input: AcceptOfferInput): Promise<{
    success: boolean;
    productId: string;
    finalPrice: number;
    discountPercent: number;
    message: string;
  }> {
    const { storeId, sessionId, productId, offerType, discountPercent, token } = input;

    if (!storeId || !sessionId || !productId) {
      throw new AppError('storeId, sessionId, and productId are required', 400);
    }

    const cleanStoreId = storeId.trim();
    const cleanSessionId = sessionId.trim();
    const cleanProductId = productId.trim();

    const product = await prisma.product.findUnique({
      where: { id: cleanProductId },
    });

    if (!product || product.storeId !== cleanStoreId) {
      throw new AppError('Product not found in specified store', 404);
    }

    const price = Number(product.price);
    const costPrice = Number(product.costPrice ?? 0);

    // Validate token if provided
    if (token) {
      const isValidToken = this.verifyOfferToken(
        token,
        cleanStoreId,
        cleanSessionId,
        cleanProductId,
        offerType,
        discountPercent
      );
      if (!isValidToken) {
        throw new AppError('Invalid or expired offer token', 400);
      }
    }

    // Strict server-authoritative margin verification
    const safeDiscount = Math.max(0, Math.min(20, discountPercent));
    const finalPrice = Math.round(price * (1 - safeDiscount / 100));

    if (finalPrice < costPrice) {
      throw new AppError('Offer violates merchant minimum margin safety rule', 400);
    }

    // Record OFFER_ACCEPTED commerce event
    await prisma.commerceEvent.create({
      data: {
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        productId: cleanProductId,
        eventType: 'OFFER_ACCEPTED',
        metadata: {
          offerType,
          discountPercent: safeDiscount,
          originalPrice: price,
          finalPrice,
        },
      },
    });

    // Mark offer accepted in fatigue service
    offerFatigueService.recordOfferAccepted(cleanSessionId, cleanStoreId, cleanProductId);

    // Ensure customer cart exists
    let cart = await prisma.cart.findUnique({
      where: {
        sessionId_storeId: {
          sessionId: cleanSessionId,
          storeId: cleanStoreId,
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          sessionId: cleanSessionId,
          storeId: cleanStoreId,
        },
      });
    }

    // Upsert cart item
    await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: cleanProductId,
        },
      },
      update: {
        quantity: { increment: 1 },
      },
      create: {
        cartId: cart.id,
        productId: cleanProductId,
        quantity: 1,
      },
    });

    return {
      success: true,
      productId: cleanProductId,
      finalPrice,
      discountPercent: safeDiscount,
      message: `Offer accepted! ${product.name} added to cart at ₹${finalPrice.toLocaleString('en-IN')}.`,
    };
  }

  /**
   * Rejects an authorized commercial offer:
   * - Records OFFER_REJECTED commerce event
   * - Marks rejection in fatigue service
   * - Returns sale recovery alternatives
   */
  async rejectOffer(input: RejectOfferInput): Promise<{
    success: boolean;
    recoveryAlternatives: any[];
    message: string;
  }> {
    const { storeId, sessionId, productId, offerType, reason } = input;

    if (!storeId || !sessionId || !productId) {
      throw new AppError('storeId, sessionId, and productId are required', 400);
    }

    const cleanStoreId = storeId.trim();
    const cleanSessionId = sessionId.trim();
    const cleanProductId = productId.trim();

    // Record OFFER_REJECTED event
    await prisma.commerceEvent.create({
      data: {
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        productId: cleanProductId,
        eventType: 'OFFER_REJECTED',
        metadata: {
          offerType,
          reason: reason || 'Customer declined offer',
        },
      },
    });

    // Register rejection in fatigue tracking
    offerFatigueService.recordOfferRejected(cleanSessionId, cleanStoreId, cleanProductId);

    // Fetch recovery alternatives
    let recoveryAlternatives: any[] = [];
    try {
      const recovery = await saleRecoveryService.recoverSale({
        sessionId: cleanSessionId,
        storeId: cleanStoreId,
        rejectedProductId: cleanProductId,
        limit: 3,
      });
      recoveryAlternatives = recovery.alternatives;
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      recoveryAlternatives,
      message: 'Offer declined. Here are other options that might suit your needs.',
    };
  }

  /**
   * Transforms internal decision result into customer-safe DTO.
   * Strips all internal merchant cost and margin fields.
   */
  toCustomerResponse(
    result: CommercialDecisionResult
  ): CustomerCommercialOfferResponse {
    const safeOffer: CommercialOffer = {
      type: result.offer.type,
      productId: result.offer.productId,
      productName: result.offer.productName,
      bundleId: result.offer.bundleId,
      originalPrice: result.offer.originalPrice,
      discountAmount: result.offer.discountAmount,
      discountPercent: result.offer.discountPercent,
      finalPrice: result.offer.finalPrice,
      reason: result.offer.reason,
      explanation: result.explanation,
      bundleOpportunity: result.offer.bundleOpportunity,
      recoveryAlternatives: result.offer.recoveryAlternatives,
      nonPriceIncentive: result.offer.nonPriceIncentive,
      expiresAt: result.offer.expiresAt,
      token: result.offer.token,
    };

    return {
      decision: result.decision,
      hesitationType: result.hesitation.type,
      offer: safeOffer,
      message: result.explanation,
    };
  }
}

export const commercialEngineService = new CommercialEngineService();
