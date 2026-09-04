import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/app.error';
import { purchaseProbabilityService } from './purchase-probability.service';
import { discountResponseService } from './discount-response.service';
import {
  OptimizeRevenueRequest,
  RevenueOptimizationResult,
  CandidateDiscountEvaluation,
} from '../../types/revenue.types';

const MAX_SESSION_ID_LENGTH = 128;
const PROFIT_TOLERANCE_EPSILON = 0.01; // Currency rounding tolerance for tie-breaking

export class RevenueOptimizerService {
  /**
   * Evaluates candidate discount actions (0%, 5%, 10%, 15%) against deterministic purchase probability
   * to select the action maximizing merchant expected profit while strictly enforcing margin safety.
   *
   * STRICT ZERO GEMINI CALLS.
   */
  async optimizeRevenue(
    input: OptimizeRevenueRequest
  ): Promise<RevenueOptimizationResult> {
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
      throw new AppError(
        `sessionId exceeds maximum length of ${MAX_SESSION_ID_LENGTH} characters`,
        400
      );
    }

    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required and must be a non-empty string', 400);
    }
    const cleanStoreId = storeId.trim();

    if (!productId || typeof productId !== 'string' || !productId.trim()) {
      throw new AppError('productId is required and must be a non-empty string', 400);
    }
    const cleanProductId = productId.trim();

    // 2. Validate Store & Product from Database
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    const product = await prisma.product.findUnique({
      where: { id: cleanProductId },
    });
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Reject cross-store access
    if (product.storeId !== cleanStoreId) {
      throw new AppError(
        'Product does not belong to the specified store',
        400
      );
    }

    const price = Number(product.price);
    const costPrice = Number(product.costPrice ?? 0);

    if (isNaN(price) || price <= 0) {
      throw new AppError('Product must have a valid selling price greater than 0', 400);
    }
    if (isNaN(costPrice) || costPrice < 0) {
      throw new AppError('Product must have a valid non-negative cost price', 400);
    }

    // 3. Obtain Baseline Purchase Probability from Phase 5B
    const probabilityResult = await purchaseProbabilityService.estimatePurchaseProbability({
      sessionId: cleanSessionId,
      storeId: cleanStoreId,
      productId: cleanProductId,
    });
    const baselineProbability = probabilityResult.purchaseProbability;

    // 4. Handle Edge Case: No Positive Margin (costPrice >= price)
    if (costPrice >= price) {
      const baselineExpectedRevenue = Number((price * baselineProbability).toFixed(2));
      const baselineExpectedProfit = Number(((price - costPrice) * baselineProbability).toFixed(2));

      return {
        productId: product.id,
        price,
        costPrice,
        purchaseProbability: baselineProbability,
        recommendedDiscount: 0,
        recommendedPrice: price,
        expectedRevenue: baselineExpectedRevenue,
        expectedProfit: baselineExpectedProfit,
        baselineExpectedProfit,
        improvement: 0,
        reason: 'Product does not have a positive profit margin; no discount can be safely offered.',
        evaluations: [
          {
            discount: 0,
            discountedPrice: price,
            unitProfit: Number((price - costPrice).toFixed(2)),
            purchaseProbability: baselineProbability,
            expectedRevenue: baselineExpectedRevenue,
            expectedProfit: baselineExpectedProfit,
            valid: true,
          },
        ],
      };
    }

    // 5. Evaluate All Candidate Discounts
    const candidateDiscounts = discountResponseService.getCandidateDiscounts();
    const evaluations: CandidateDiscountEvaluation[] = [];

    for (const discount of candidateDiscounts) {
      const discountAmount = Number((price * (discount / 100)).toFixed(2));
      const discountedPrice = Number((price - discountAmount).toFixed(2));
      const unitProfit = Number((discountedPrice - costPrice).toFixed(2));

      // Margin Safety: discountedPrice must be strictly greater than costPrice
      if (unitProfit <= 0) {
        evaluations.push({
          discount,
          discountedPrice,
          unitProfit,
          purchaseProbability: 0,
          expectedRevenue: 0,
          expectedProfit: 0,
          valid: false,
          invalidReason: 'Violates minimum margin safety rule (discounted price <= cost price)',
        });
        continue;
      }

      // Estimate conversion probability under discount
      const discountProb = discountResponseService.estimateDiscountProbability(
        baselineProbability,
        discount
      );
      const expectedRevenue = Number((discountedPrice * discountProb).toFixed(2));
      const expectedProfit = Number((unitProfit * discountProb).toFixed(2));

      evaluations.push({
        discount,
        discountedPrice,
        unitProfit,
        purchaseProbability: discountProb,
        expectedRevenue,
        expectedProfit,
        valid: true,
      });
    }

    // 6. Baseline (0% discount) Evaluation
    const baselineEval = evaluations.find((e) => e.discount === 0);
    const baselineExpectedProfit = baselineEval && baselineEval.valid ? baselineEval.expectedProfit : 0;

    // 7. Optimization Decision Logic
    const validEvaluations = evaluations.filter((e) => e.valid);

    if (validEvaluations.length === 0) {
      // Fallback if somehow all options violate margin
      return {
        productId: product.id,
        price,
        costPrice,
        purchaseProbability: baselineProbability,
        recommendedDiscount: 0,
        recommendedPrice: price,
        expectedRevenue: Number((price * baselineProbability).toFixed(2)),
        expectedProfit: 0,
        baselineExpectedProfit: 0,
        improvement: 0,
        reason: 'All candidate discount options violate the minimum margin safety rule, so full price is maintained.',
        evaluations,
      };
    }

    // Start with 0% baseline as selected action
    let bestOption: CandidateDiscountEvaluation = baselineEval && baselineEval.valid ? baselineEval : validEvaluations[0];

    for (const option of validEvaluations) {
      if (option.discount === 0) continue;

      // Only consider if expected profit is strictly higher than bestOption (accounting for epsilon)
      const profitDelta = option.expectedProfit - bestOption.expectedProfit;

      if (profitDelta > PROFIT_TOLERANCE_EPSILON) {
        bestOption = option;
      } else if (Math.abs(profitDelta) <= PROFIT_TOLERANCE_EPSILON) {
        // Equal profit tie-breaker: prefer the smaller discount
        if (option.discount < bestOption.discount) {
          bestOption = option;
        }
      }
    }

    // No-Discount Preference Check:
    // If bestOption does not strictly beat the 0% baseline by more than tolerance, stick to 0%
    if (
      bestOption.discount > 0 &&
      baselineEval &&
      baselineEval.valid &&
      bestOption.expectedProfit <= baselineExpectedProfit + PROFIT_TOLERANCE_EPSILON
    ) {
      bestOption = baselineEval;
    }

    const improvement = Number((bestOption.expectedProfit - baselineExpectedProfit).toFixed(2));

    // 8. Construct Explanatory Reason
    let reason = '';
    if (bestOption.discount === 0) {
      if (baselineProbability >= 0.7) {
        reason = 'No discount is recommended because the customer already exhibits high purchase intent, and full price maximizes merchant profit.';
      } else if (validEvaluations.length === 1) {
        reason = 'Candidate discounts violate margin safety thresholds, so full price is maintained.';
      } else {
        reason = 'No discount option improves expected profit over the full price baseline.';
      }
    } else {
      reason = `A ${bestOption.discount}% discount produces the highest expected profit among valid options (expected profit ₹${bestOption.expectedProfit.toFixed(2)}, +₹${improvement.toFixed(2)} vs baseline).`;
    }

    return {
      productId: product.id,
      price,
      costPrice,
      purchaseProbability: bestOption.purchaseProbability,
      recommendedDiscount: bestOption.discount,
      recommendedPrice: bestOption.discountedPrice,
      expectedRevenue: bestOption.expectedRevenue,
      expectedProfit: bestOption.expectedProfit,
      baselineExpectedProfit,
      improvement,
      reason,
      evaluations,
    };
  }
}

export const revenueOptimizerService = new RevenueOptimizerService();
