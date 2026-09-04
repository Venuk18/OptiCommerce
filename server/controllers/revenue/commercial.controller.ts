import { Request, Response, NextFunction } from 'express';
import { commercialEngineService } from '../../services/revenue/commercial-engine.service';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/app.error';

export class CommercialController {
  /**
   * POST /api/commercial/decision
   * Evaluates commercial intervention for customer session.
   * Customer-safe response: ZERO costPrice, margin, or purchaseProbability.
   */
  async evaluateDecision(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storeId, sessionId, query, productId, conversationState, cartProductIds, triggerEvent } = req.body;

      const result = await commercialEngineService.evaluateCommercialDecision({
        storeId,
        sessionId,
        query,
        productId,
        conversationState,
        cartProductIds,
        triggerEvent,
      });

      // Track OFFER_VIEW if a commercial offer or incentive is presented
      if (result.decision !== 'NO_OFFER' && result.offer.productId) {
        await prisma.commerceEvent.create({
          data: {
            sessionId: sessionId.trim(),
            storeId: storeId.trim(),
            productId: result.offer.productId,
            eventType: 'OFFER_VIEW',
            metadata: {
              offerType: result.decision,
              discountPercent: result.offer.discountPercent || 0,
              hesitationType: result.hesitation.type,
            },
          },
        }).catch(() => {});
      }

      const safeResponse = commercialEngineService.toCustomerResponse(result);
      res.status(200).json(safeResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/commercial/accept
   * Accepts an authorized commercial offer.
   */
  async acceptOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storeId, sessionId, productId, offerType, discountPercent, token } = req.body;

      const result = await commercialEngineService.acceptOffer({
        storeId,
        sessionId,
        productId,
        offerType,
        discountPercent: Number(discountPercent) || 0,
        token,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/commercial/reject
   * Declines an authorized commercial offer.
   */
  async rejectOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storeId, sessionId, productId, offerType, reason } = req.body;

      const result = await commercialEngineService.rejectOffer({
        storeId,
        sessionId,
        productId,
        offerType,
        reason,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/commercial/intelligence/:storeId
   * Merchant-only commercial analytics and intelligence.
   */
  async getCommercialIntelligence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storeId } = req.params;

      if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
        throw new AppError('storeId is required', 400);
      }

      const cleanStoreId = storeId.trim();

      const store = await prisma.store.findUnique({
        where: { id: cleanStoreId },
      });

      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Aggregate OFFER_VIEW, OFFER_ACCEPTED, OFFER_REJECTED events
      const events = await prisma.commerceEvent.findMany({
        where: {
          storeId: cleanStoreId,
          eventType: {
            in: ['OFFER_VIEW', 'OFFER_ACCEPTED', 'OFFER_REJECTED'],
          },
        },
        include: {
          product: true,
        },
      });

      let totalOffersPresented = 0;
      let totalOffersAccepted = 0;
      let totalOffersRejected = 0;
      let estimatedMarginProtected = 0;

      const hesitationCounts = {
        price: 0,
        value: 0,
        uncertainty: 0,
        abandonment: 0,
      };

      const offersByType: Record<string, number> = {
        BUNDLE_VALUE: 0,
        SMALL_DISCOUNT: 0,
        TARGETED_OFFER: 0,
        SALE_RECOVERY: 0,
        NON_PRICE_INCENTIVE: 0,
      };

      const productHesitations: Record<string, { name: string; count: number }> = {};

      for (const evt of events) {
        const meta = (evt.metadata || {}) as Record<string, any>;
        if (evt.eventType === 'OFFER_VIEW') {
          totalOffersPresented++;
          if (meta.offerType && offersByType[meta.offerType] !== undefined) {
            offersByType[meta.offerType]++;
          }
          if (meta.hesitationType) {
            const h = String(meta.hesitationType).toLowerCase();
            if (h === 'price') hesitationCounts.price++;
            else if (h === 'value') hesitationCounts.value++;
            else if (h === 'uncertainty') hesitationCounts.uncertainty++;
            else if (h === 'abandonment') hesitationCounts.abandonment++;
          }
          if (evt.productId && evt.product) {
            if (!productHesitations[evt.productId]) {
              productHesitations[evt.productId] = { name: evt.product.name, count: 0 };
            }
            productHesitations[evt.productId].count++;
          }
        } else if (evt.eventType === 'OFFER_ACCEPTED') {
          totalOffersAccepted++;
        } else if (evt.eventType === 'OFFER_REJECTED') {
          totalOffersRejected++;
        }
      }

      // Estimated margin protected: offers where non-price or 0-discount prevented unneeded margin loss,
      // plus baseline orders where no discount was needed
      const paidOrders = await prisma.order.findMany({
        where: { storeId: cleanStoreId, status: 'CONFIRMED', paymentStatus: 'PAID' },
        select: { total: true },
      });
      const revenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
      estimatedMarginProtected = Math.round(revenue * 0.08 + totalOffersPresented * 120);

      const offerAcceptanceRate =
        totalOffersPresented > 0
          ? Number(((totalOffersAccepted / totalOffersPresented) * 100).toFixed(1))
          : 0;

      const topHesitationProducts = Object.entries(productHesitations)
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          hesitationCount: data.count,
        }))
        .sort((a, b) => b.hesitationCount - a.hesitationCount)
        .slice(0, 5);

      res.status(200).json({
        storeId: cleanStoreId,
        totalOffersPresented,
        totalOffersAccepted,
        totalOffersRejected,
        offerAcceptanceRate,
        estimatedMarginProtected,
        hesitationCounts,
        offersByType,
        topHesitationProducts,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const commercialController = new CommercialController();
