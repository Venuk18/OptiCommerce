import { DiscussedProduct } from '../../types/recommendation.types';
import { ReferenceResolutionResult } from '../../types/intent.types';

export class ReferenceResolverService {
  /**
   * Deterministically resolves customer product references against discussed products in conversationState.
   * Runs in 0 Gemini calls, ensuring instant execution and zero hallucinations.
   */
  resolveReferences(
    query: string,
    discussedProducts: DiscussedProduct[],
    focusedProductId?: string | null
  ): ReferenceResolutionResult {
    const lowerQuery = query.toLowerCase().trim();

    if (!discussedProducts || discussedProducts.length === 0) {
      return {
        resolved: false,
        mode: 'none',
        referencedPositions: [],
        referencedProductIds: [],
      };
    }

    const maxPosition = discussedProducts.length;

    // 1. Detect invalid / out-of-bounds ordinal references (e.g. "fourth one", "4th product", "option 4", "5th")
    const outOfBoundsPatterns = [
      { pattern: /\b(fourth|4th|option\s*4|#4|number\s*4)\b/i, requestedPos: 4 },
      { pattern: /\b(fifth|5th|option\s*5|#5|number\s*5)\b/i, requestedPos: 5 },
      { pattern: /\b(sixth|6th|option\s*6|#6|number\s*6)\b/i, requestedPos: 6 },
    ];

    for (const check of outOfBoundsPatterns) {
      if (check.pattern.test(lowerQuery) && check.requestedPos > maxPosition) {
        const optionWords = ['first', 'second', 'third', 'fourth', 'fifth'];
        const validOptionsText = optionWords
          .slice(0, maxPosition)
          .join(', ')
          .replace(/, ([^,]*)$/, ', or $1');

        return {
          resolved: false,
          mode: 'invalid',
          referencedPositions: [check.requestedPos],
          referencedProductIds: [],
          unresolvedMessage: `I only showed you ${maxPosition} option${maxPosition > 1 ? 's' : ''}. Did you mean the ${validOptionsText} one?`,
        };
      }
    }

    // 2. Relative Price Comparatives (Deterministic price sorting)
    // Cheapest / lowest price / cheaper
    const cheapestPatterns = /\b(cheaper(\s+one|\s+option)?|cheapest(\s+one)?|lowest\s+price(d)?|least\s+expensive)\b/i;
    // Most expensive / pricier / higher price
    const expensivePatterns = /\b(more\s+expensive(\s+one|\s+option)?|most\s+expensive(\s+one)?|highest\s+price(d)?|pricier|priciest)\b/i;

    if (cheapestPatterns.test(lowerQuery)) {
      const sortedByPriceAsc = [...discussedProducts].sort((a, b) => a.price - b.price);
      const cheapest = sortedByPriceAsc[0];
      return {
        resolved: true,
        mode: 'single',
        referencedPositions: [cheapest.position],
        referencedProductIds: [cheapest.id],
        comparisonAttribute: 'price',
      };
    }

    if (expensivePatterns.test(lowerQuery)) {
      const sortedByPriceDesc = [...discussedProducts].sort((a, b) => b.price - a.price);
      const expensive = sortedByPriceDesc[0];
      return {
        resolved: true,
        mode: 'single',
        referencedPositions: [expensive.position],
        referencedProductIds: [expensive.id],
        comparisonAttribute: 'price',
      };
    }

    // 3. Multi-product references (e.g. "first and third", "first and second", "compare these three", "all three")
    const resolvedPositions: number[] = [];

    // Check "all three" / "these three"
    if (/\b(all\s+three|these\s+three|all\s+of\s+them|compare\s+(them|all|these))\b/i.test(lowerQuery)) {
      return {
        resolved: true,
        mode: 'multiple',
        referencedPositions: discussedProducts.map((p) => p.position),
        referencedProductIds: discussedProducts.map((p) => p.id),
      };
    }

    // Check explicit positions
    const pos1Pattern = /\b(first(\s+one|\s+product|\s+option)?|1st|option\s*1|#1|number\s*1)\b/i;
    const pos2Pattern = /\b(second(\s+one|\s+product|\s+option)?|2nd|option\s*2|#2|number\s*2)\b/i;
    const pos3Pattern = /\b(third(\s+one|\s+product|\s+option)?|3rd|option\s*3|#3|number\s*3)\b/i;
    const lastPattern = /\b(last(\s+one|\s+product|\s+option)?)\b/i;

    if (pos1Pattern.test(lowerQuery) && maxPosition >= 1) {
      resolvedPositions.push(1);
    }
    if (pos2Pattern.test(lowerQuery) && maxPosition >= 2) {
      resolvedPositions.push(2);
    }
    if (pos3Pattern.test(lowerQuery) && maxPosition >= 3) {
      resolvedPositions.push(3);
    }
    if (lastPattern.test(lowerQuery) && maxPosition >= 1 && !resolvedPositions.includes(maxPosition)) {
      resolvedPositions.push(maxPosition);
    }

    if (resolvedPositions.length > 1) {
      const uniquePositions = Array.from(new Set(resolvedPositions)).sort((a, b) => a - b);
      const matchedProducts = discussedProducts.filter((p) => uniquePositions.includes(p.position));
      return {
        resolved: true,
        mode: 'multiple',
        referencedPositions: uniquePositions,
        referencedProductIds: matchedProducts.map((p) => p.id),
      };
    }

    if (resolvedPositions.length === 1) {
      const targetPos = resolvedPositions[0];
      const matchedProduct = discussedProducts.find((p) => p.position === targetPos);
      return {
        resolved: true,
        mode: 'single',
        referencedPositions: [targetPos],
        referencedProductIds: matchedProduct ? [matchedProduct.id] : [],
      };
    }

    // 4. Pronoun references ("this one", "that one", "this product", "that product", "this", "that")
    const pronounPattern = /\b(this(\s+one|\s+product)?|that(\s+one|\s+product)?)\b/i;
    if (pronounPattern.test(lowerQuery)) {
      if (focusedProductId) {
        const matched = discussedProducts.find((p) => p.id === focusedProductId);
        if (matched) {
          return {
            resolved: true,
            mode: 'single',
            referencedPositions: [matched.position],
            referencedProductIds: [matched.id],
          };
        }
      }
      // If no focusedProductId is active, default to the top/first discussed product
      const topProd = discussedProducts[0];
      return {
        resolved: true,
        mode: 'single',
        referencedPositions: [topProd.position],
        referencedProductIds: [topProd.id],
      };
    }

    // 5. Best rated / highest rated
    if (/\b(best\s+rated|highest\s+rated|top\s+rated)\b/i.test(lowerQuery)) {
      // By default rank 1 is the best match/highest rated
      const topProd = discussedProducts[0];
      return {
        resolved: true,
        mode: 'single',
        referencedPositions: [topProd.position],
        referencedProductIds: [topProd.id],
      };
    }

    return {
      resolved: false,
      mode: 'none',
      referencedPositions: [],
      referencedProductIds: [],
    };
  }
}

export const referenceResolverService = new ReferenceResolverService();
