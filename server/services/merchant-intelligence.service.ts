import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';
import { merchantDashboardService } from './merchant-dashboard.service';
import {
  MerchantInsight,
  MerchantIntelligenceSummary,
} from '../types/merchant-dashboard.types';

export class MerchantIntelligenceService {
  /**
   * Deterministic type priority rank for deterministic insight ordering.
   */
  private readonly typePriority: Record<MerchantInsight['type'], number> = {
    SYSTEM_STATUS: 1,
    CHECKOUT_BOTTLENECK: 2,
    FUNNEL_BOTTLENECK: 3,
    ATTRIBUTION_AI: 4,
    BUNDLE_PERFORMANCE: 5,
    OFFER_PERFORMANCE: 6,
    RECOVERY_PERFORMANCE: 7,
    PRODUCT_OPPORTUNITY: 8,
  };

  /**
   * Severity priority rank (WARNING > OPPORTUNITY > INFO).
   */
  private readonly severityPriority: Record<MerchantInsight['severity'], number> = {
    WARNING: 1,
    OPPORTUNITY: 2,
    INFO: 3,
  };

  /**
   * Generates deterministic, actionable merchant revenue intelligence insights.
   *
   * STRICT GUARANTEES:
   * - Read-only analytics (zero database writes).
   * - ZERO Gemini / AI API model invocations.
   * - Strict store isolation (never mixes data between stores).
   * - Strips all internal merchant costs/margins (costPrice, expectedProfit, purchaseProbability).
   * - Strips all customer PII (names, emails, phones, tokens, session IDs).
   * - Deterministic output with minimum-volume diagnostic guards.
   * - Maximum 6 bounded insights.
   */
  async generateInsights(storeId: string): Promise<MerchantIntelligenceSummary> {
    // 1. Validation
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanStoreId = storeId.trim();

    // 2. Verify Store exists
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    const generatedAt = new Date().toISOString();

    // 3. Fetch existing validated aggregates in parallel
    const [summary, funnel, attribution] = await Promise.all([
      merchantDashboardService.getSummary(cleanStoreId),
      merchantDashboardService.getFunnel(cleanStoreId),
      merchantDashboardService.getAttributionSummary(cleanStoreId),
    ]);

    const rawInsights: MerchantInsight[] = [];

    // 4. Zero-Data / Insufficient Volume Guard
    const hasMinimalActivity =
      summary.totalOrders > 0 ||
      funnel.productViews >= 5 ||
      funnel.recommendationViews >= 5 ||
      funnel.checkoutStarted >= 5;

    if (!hasMinimalActivity) {
      rawInsights.push({
        id: `insight-zero-data-${cleanStoreId}`,
        type: 'SYSTEM_STATUS',
        severity: 'INFO',
        title: 'Collecting enough data',
        description:
          'Revenue intelligence will become more useful as customer activity grows.',
        metric: 0,
        metricLabel: 'Activity Volume',
        recommendation:
          'Drive initial customer traffic to your store to unlock AI revenue optimizations and funnel analytics.',
        createdAt: generatedAt,
      });

      return {
        storeId: cleanStoreId,
        generatedAt,
        insights: rawInsights,
        metricsSnapshot: {
          totalRevenue: summary.totalRevenue,
          aiInfluencedShare: attribution.aiInfluencedShare,
          checkoutConversionRate: funnel.checkoutConversionRate,
          offerAcceptanceRate: funnel.offerAcceptanceRate,
        },
      };
    }

    // 5. AI Attribution Insight (Rule-based, Non-causal)
    if (attribution.totalAttributedRevenue > 0) {
      if (attribution.aiInfluencedRevenue > 0) {
        const isHighShare = attribution.aiInfluencedShare >= 20;
        rawInsights.push({
          id: `insight-attribution-ai-${cleanStoreId}`,
          type: 'ATTRIBUTION_AI',
          severity: isHighShare ? 'INFO' : 'OPPORTUNITY',
          title: 'AI-Influenced Revenue',
          description: `AI-influenced activity accounts for ${attribution.aiInfluencedShare}% of attributed revenue (₹${attribution.aiInfluencedRevenue.toFixed(2)}).`,
          metric: attribution.aiInfluencedShare,
          metricLabel: 'AI Revenue Share',
          recommendation: isHighShare
            ? 'Continue leveraging AI shopping assistant, bundle recommendations, and personalized offers to maintain strong conversion.'
            : 'Engage more shoppers with AI chat and dynamic offers to increase AI-influenced sales.',
          createdAt: generatedAt,
        });
      }
    }

    // 6. Bundle Performance Insight
    if (attribution.bundleRevenue > 0) {
      rawInsights.push({
        id: `insight-bundle-${cleanStoreId}`,
        type: 'BUNDLE_PERFORMANCE',
        severity: 'INFO',
        title: 'Bundle Recommendation Revenue',
        description: `Bundle recommendations generated ₹${attribution.bundleRevenue.toFixed(2)} in attributed revenue.`,
        metric: attribution.bundleRevenue,
        metricLabel: 'Bundle Revenue',
        recommendation:
          'Review high-performing product pairs to identify additional cross-sell opportunities.',
        createdAt: generatedAt,
      });
    } else if (funnel.recommendationViews >= 5 && attribution.bundleRevenue === 0) {
      rawInsights.push({
        id: `insight-bundle-opp-${cleanStoreId}`,
        type: 'BUNDLE_PERFORMANCE',
        severity: 'OPPORTUNITY',
        title: 'Bundle Optimization Opportunity',
        description: `Recommendations are active with ${funnel.recommendationViews} views, but have not generated bundle revenue yet.`,
        metric: 0,
        metricLabel: 'Bundle Revenue',
        recommendation:
          'Ensure complementary products are linked to encourage multi-item bundle purchases.',
        createdAt: generatedAt,
      });
    }

    // 7. Offer Performance Insight (Requires minimum 5 offer views)
    if (funnel.offerViews >= 5) {
      if (funnel.offerAcceptanceRate >= 30) {
        rawInsights.push({
          id: `insight-offer-strong-${cleanStoreId}`,
          type: 'OFFER_PERFORMANCE',
          severity: 'INFO',
          title: 'Strong Offer Acceptance',
          description: `Offer acceptance is ${funnel.offerAcceptanceRate}% across ${funnel.offerViews} offer views (₹${attribution.offerRevenue.toFixed(2)} in offer revenue).`,
          metric: funnel.offerAcceptanceRate,
          metricLabel: 'Offer Acceptance Rate',
          recommendation:
            'Dynamic pricing incentives are resonating well with high purchase intent shoppers.',
          createdAt: generatedAt,
        });
      } else {
        rawInsights.push({
          id: `insight-offer-opp-${cleanStoreId}`,
          type: 'OFFER_PERFORMANCE',
          severity: 'OPPORTUNITY',
          title: 'Offer Acceptance Opportunity',
          description: `Offer acceptance is ${funnel.offerAcceptanceRate}% across ${funnel.offerViews} offer views.`,
          metric: funnel.offerAcceptanceRate,
          metricLabel: 'Offer Acceptance Rate',
          recommendation:
            'Consider refining offer discount thresholds to improve shopper conversion during negotiations.',
          createdAt: generatedAt,
        });
      }
    }

    // 8. Recovery Performance Insight
    if (attribution.recoveredRevenue > 0 || summary.recoveredSales > 0) {
      rawInsights.push({
        id: `insight-recovery-${cleanStoreId}`,
        type: 'RECOVERY_PERFORMANCE',
        severity: 'INFO',
        title: 'Cart Recovery Performance',
        description: `Recovery offers attributed ₹${attribution.recoveredRevenue.toFixed(2)} across ${summary.recoveredSales} recovered sales.`,
        metric: attribution.recoveredRevenue,
        metricLabel: 'Recovered Revenue',
        recommendation:
          'Automated exit intent and abandonment recovery offers are actively recapturing at-risk revenue.',
        createdAt: generatedAt,
      });
    }

    // 9. Funnel Bottlenecks (Minimum volume guard: >= 5 events)
    // A. Discovery Bottleneck (Recommendation Views >= 5)
    if (funnel.recommendationViews >= 5) {
      if (funnel.recommendationClickRate < 10) {
        rawInsights.push({
          id: `insight-discovery-bottleneck-${cleanStoreId}`,
          type: 'FUNNEL_BOTTLENECK',
          severity: 'WARNING',
          title: 'Discovery Bottleneck: Low Recommendation CTR',
          description: `Shoppers viewed recommendations ${funnel.recommendationViews} times with a ${funnel.recommendationClickRate}% click-through rate.`,
          metric: funnel.recommendationClickRate,
          metricLabel: 'Recommendation CTR',
          recommendation:
            'Improve recommendation relevance and visibility on product pages to drive higher engagement.',
          createdAt: generatedAt,
        });
      } else if (funnel.recommendationClickRate < 20) {
        rawInsights.push({
          id: `insight-discovery-opp-${cleanStoreId}`,
          type: 'FUNNEL_BOTTLENECK',
          severity: 'OPPORTUNITY',
          title: 'Recommendation Engagement Opportunity',
          description: `Recommendation click-through rate is ${funnel.recommendationClickRate}% across ${funnel.recommendationViews} views.`,
          metric: funnel.recommendationClickRate,
          metricLabel: 'Recommendation CTR',
          recommendation:
            'Fine-tune cross-sell suggestions to make recommended items more relevant to shopper intent.',
          createdAt: generatedAt,
        });
      }
    }

    // B. Evaluation Bottleneck (Product Views >= 5)
    if (funnel.productViews >= 5) {
      if (funnel.addToCartRate < 5) {
        rawInsights.push({
          id: `insight-eval-bottleneck-${cleanStoreId}`,
          type: 'FUNNEL_BOTTLENECK',
          severity: 'WARNING',
          title: 'Evaluation Bottleneck: Low Add-to-Cart Rate',
          description: `Product views (${funnel.productViews}) have a low add-to-cart conversion rate of ${funnel.addToCartRate}%.`,
          metric: funnel.addToCartRate,
          metricLabel: 'Add-to-Cart Rate',
          recommendation:
            'Review product descriptions, imagery, and pricing to reduce friction before adding items to cart.',
          createdAt: generatedAt,
        });
      } else if (funnel.addToCartRate < 10) {
        rawInsights.push({
          id: `insight-eval-opp-${cleanStoreId}`,
          type: 'FUNNEL_BOTTLENECK',
          severity: 'OPPORTUNITY',
          title: 'Add-to-Cart Conversion Opportunity',
          description: `Add-to-cart rate is ${funnel.addToCartRate}% across ${funnel.productViews} product views.`,
          metric: funnel.addToCartRate,
          metricLabel: 'Add-to-Cart Rate',
          recommendation:
            'Highlight key product benefits and stock availability to encourage shoppers to add items to cart.',
          createdAt: generatedAt,
        });
      }
    }

    // C. Checkout Bottleneck (Checkout Started >= 5)
    if (funnel.checkoutStarted >= 5) {
      if (funnel.checkoutConversionRate < 20) {
        rawInsights.push({
          id: `insight-checkout-bottleneck-${cleanStoreId}`,
          type: 'CHECKOUT_BOTTLENECK',
          severity: 'WARNING',
          title: 'Checkout Bottleneck: High Abandonment',
          description: `Checkout completion rate is ${funnel.checkoutConversionRate}% across ${funnel.checkoutStarted} started checkouts.`,
          metric: funnel.checkoutConversionRate,
          metricLabel: 'Checkout Conversion',
          recommendation:
            'Ensure payment gateways and shipping options are clear to minimize checkout drop-offs.',
          createdAt: generatedAt,
        });
      } else if (funnel.checkoutConversionRate < 30) {
        rawInsights.push({
          id: `insight-checkout-opp-${cleanStoreId}`,
          type: 'CHECKOUT_BOTTLENECK',
          severity: 'OPPORTUNITY',
          title: 'Checkout Completion Opportunity',
          description: `Checkout completion rate is ${funnel.checkoutConversionRate}% across ${funnel.checkoutStarted} started checkouts.`,
          metric: funnel.checkoutConversionRate,
          metricLabel: 'Checkout Conversion',
          recommendation:
            'Streamline checkout steps and leverage exit-intent recovery offers to recapture abandoned checkouts.',
          createdAt: generatedAt,
        });
      }
    }

    // 10. Product Opportunity (Top attributed product)
    try {
      const paidOrderItems = await prisma.orderItem.findMany({
        where: {
          order: {
            storeId: cleanStoreId,
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
          },
          attributionSource: {
            not: 'DIRECT',
          },
        },
        select: {
          productId: true,
          productName: true,
          lineTotal: true,
        },
      });

      if (paidOrderItems.length > 0) {
        const productTotals: Record<string, { productName: string; total: number }> = {};
        for (const item of paidOrderItems) {
          const pid = item.productId;
          const total = Number(item.lineTotal) || 0;
          if (!productTotals[pid]) {
            productTotals[pid] = { productName: item.productName, total: 0 };
          }
          productTotals[pid].total += total;
        }

        const sortedProducts = Object.values(productTotals).sort((a, b) => b.total - a.total);
        if (sortedProducts.length > 0 && sortedProducts[0].total > 0) {
          const topProd = sortedProducts[0];
          rawInsights.push({
            id: `insight-product-top-${cleanStoreId}`,
            type: 'PRODUCT_OPPORTUNITY',
            severity: 'INFO',
            title: 'Top AI-Attributed Product',
            description: `"${topProd.productName}" generated ₹${topProd.total.toFixed(2)} in AI-attributed revenue.`,
            metric: Number(topProd.total.toFixed(2)),
            metricLabel: 'Attributed Product Revenue',
            recommendation:
              'Feature this product prominently in homepage collections and AI search suggestions.',
            createdAt: generatedAt,
          });
        }
      }
    } catch {
      // Gracefully omit product-level insights if query unavailable
    }

    // 11. Deterministic Sorting & Bounding (Max 6 insights)
    // Priority: WARNING (1) > OPPORTUNITY (2) > INFO (3)
    // Tie-breaker: typePriority
    const sortedInsights = rawInsights.sort((a, b) => {
      const severityDiff = this.severityPriority[a.severity] - this.severityPriority[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return this.typePriority[a.type] - this.typePriority[b.type];
    });

    const boundedInsights = sortedInsights.slice(0, 6);

    // Fallback to system status if no insights matched
    if (boundedInsights.length === 0) {
      boundedInsights.push({
        id: `insight-system-status-${cleanStoreId}`,
        type: 'SYSTEM_STATUS',
        severity: 'INFO',
        title: 'Collecting enough data',
        description:
          'Revenue intelligence will become more useful as customer activity grows.',
        metric: 0,
        metricLabel: 'Activity Volume',
        recommendation:
          'Drive initial customer traffic to your store to unlock AI revenue optimizations and funnel analytics.',
        createdAt: generatedAt,
      });
    }

    return {
      storeId: cleanStoreId,
      generatedAt,
      insights: boundedInsights,
      metricsSnapshot: {
        totalRevenue: summary.totalRevenue,
        aiInfluencedShare: attribution.aiInfluencedShare,
        checkoutConversionRate: funnel.checkoutConversionRate,
        offerAcceptanceRate: funnel.offerAcceptanceRate,
      },
    };
  }
}

export const merchantIntelligenceService = new MerchantIntelligenceService();
