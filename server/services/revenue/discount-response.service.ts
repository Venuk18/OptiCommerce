/**
 * Discount-Response Model (Phase 5C)
 *
 * Estimates customer purchase probability uplift when an incentive / discount is applied.
 *
 * MODEL ASSUMPTIONS & DESIGN:
 * 1. Deterministic & Explainable: Computes conversion probability analytically without stochastic randomness.
 * 2. Baseline Grounding: Grounded directly on the baseline purchase probability (p0) from Phase 5B.
 * 3. Headroom-Scaled Uplift: A discount activates price-sensitive shoppers from the unconverted headroom (1 - p0).
 *    When p0 is already high (e.g. 0.85), headroom is small (0.15), reflecting that customer is already sold.
 *    When p0 is low (e.g. 0.10), headroom is large (0.90), reflecting substantial price sensitivity.
 * 4. Diminishing Returns: Successive increments in discount yield progressively smaller marginal conversion increases.
 * 5. Strict Bounds: Resulting probability is strictly clamped within [0.01, 0.98].
 * 6. ZERO GEMINI / LLM CALLS: 100% mathematical and algebraic rules.
 *
 * Uplift schedule for candidate discounts:
 * - 0% discount  -> 0.00 headroom activated (baseline unchanged)
 * - 5% discount  -> 0.18 headroom activated (+18% marginal)
 * - 10% discount -> 0.32 headroom activated (+14% marginal)
 * - 15% discount -> 0.42 headroom activated (+10% marginal)
 */

export const CANDIDATE_DISCOUNTS = [0, 5, 10, 15] as const;
export type CandidateDiscount = (typeof CANDIDATE_DISCOUNTS)[number];

// Explicit headroom activation factor per candidate discount percentage
const DISCOUNT_UPLIFT_FACTORS: Record<number, number> = {
  0: 0.0,
  5: 0.18,
  10: 0.32,
  15: 0.42,
};

export class DiscountResponseService {
  /**
   * Calculates estimated conversion probability given a baseline probability and discount percentage.
   *
   * @param baselineProbability Baseline purchase probability from Phase 5B (0.0 to 1.0)
   * @param discountPercentage Discount percentage (e.g. 0, 5, 10, 15)
   * @returns Bounded estimated purchase probability with discount applied (0.0 to 1.0)
   */
  estimateDiscountProbability(
    baselineProbability: number,
    discountPercentage: number
  ): number {
    // 1. Sanitize & bound baseline probability
    const safeBaseline = Math.max(0.0, Math.min(1.0, baselineProbability));

    if (discountPercentage <= 0) {
      return Number(safeBaseline.toFixed(4));
    }

    // 2. Determine uplift factor (via lookup table or logarithmic curve for arbitrary discounts)
    let upliftFactor = DISCOUNT_UPLIFT_FACTORS[discountPercentage];
    if (upliftFactor === undefined) {
      // General diminishing-returns logarithmic curve fallback: factor = 0.50 * (1 - e^(-0.06 * d))
      upliftFactor = 0.5 * (1 - Math.exp(-0.06 * discountPercentage));
    }

    // 3. Apply headroom activation: p(d) = p0 + (1 - p0) * factor
    const unconvertedHeadroom = Math.max(0, 1.0 - safeBaseline);
    const rawNewProbability = safeBaseline + unconvertedHeadroom * upliftFactor;

    // 4. Strict bounding within [0.01, 0.98] to avoid unrealistically absolute certainty
    const boundedProbability = Math.max(0.01, Math.min(0.98, rawNewProbability));

    // Return rounded to 4 decimal places for precise downstream profit calculations
    return Number(boundedProbability.toFixed(4));
  }

  /**
   * Returns all standard candidate discount percentages.
   */
  getCandidateDiscounts(): readonly number[] {
    return CANDIDATE_DISCOUNTS;
  }
}

export const discountResponseService = new DiscountResponseService();
