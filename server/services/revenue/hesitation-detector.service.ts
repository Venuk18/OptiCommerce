import { HesitationSignal, HesitationType } from '../../types/commercial.types';
import { ConversationState } from '../../types/recommendation.types';

export class HesitationDetectorService {
  /**
   * Deterministically classifies customer query or interaction into commercially meaningful hesitation signals.
   * STRICT ZERO GEMINI CALLS.
   */
  detectHesitation(
    query?: string,
    state?: ConversationState
  ): HesitationSignal {
    const rawText = (query || '').trim();
    const lower = rawText.toLowerCase();

    if (!lower) {
      return {
        type: 'NONE',
        confidence: 0,
        rawText,
      };
    }

    // 1. First guard: Ready to purchase or positive checkout intent is NEVER hesitation!
    const purchaseIntentPattern =
      /\b(i'?ll\s+(take|buy)\s+(this|it|option)|add\s+to\s+cart|proceed\s+to\s+checkout|ready\s+to\s+buy|ready\s+to\s+order|let'?s\s+buy|place\s+(my\s+)?order|going\s+to\s+buy|buy\s+now)\b/i;
    const isUncertainOrConditional =
      /\b(not\s+sure|should\s+i\s+buy|if\s+i\s+should|hesitat|second\s+thoughts|think(ing)?\s+about|maybe|worth)\b/i.test(
        lower
      );

    if (purchaseIntentPattern.test(lower) && !isUncertainOrConditional) {
      return {
        type: 'NONE',
        confidence: 1.0,
        triggerPhrase: 'positive_purchase_intent',
        rawText,
      };
    }

    // 2. Second guard: Pure product questions without price hesitation must NOT trigger hesitation
    // e.g. "Does the second one have ANC?", "Is it waterproof?", "How much is it?", "Tell me about battery life"
    const isPureSpecQuestion =
      /^(does\s+(it|this|the|option)|is\s+(it|this|the|option)|has\s+(it|this|the|option)|what\s+is\s+the\s+(price|battery|warranty|spec)|tell\s+me\s+about\s+(the\s+)?(battery|spec|features?|mic|anc|sound|color))/i.test(
        lower
      ) &&
      !/\b(expensive|costly|pricier|cheaper|discount|offer|deal|budget|afford|worth)\b/i.test(
        lower
      );

    if (isPureSpecQuestion) {
      return {
        type: 'NONE',
        confidence: 0.9,
        triggerPhrase: 'product_spec_question',
        rawText,
      };
    }

    // 3. Third guard: Product comparison requests without price complaints
    // e.g. "Compare the first and third", "Which one has the best battery life?"
    const isPureComparison =
      /\b(compare|versus|\bvs\b|difference\s+between|which\s+(one\s+)?has\s+better)\b/i.test(
        lower
      ) &&
      !/\b(expensive|costly|discount|offer|deal|too\s+much|can'?t\s+afford|worth)\b/i.test(
        lower
      );

    if (isPureComparison) {
      return {
        type: 'NONE',
        confidence: 0.9,
        triggerPhrase: 'product_comparison',
        rawText,
      };
    }

    // 4. Detection Category A: Explicit PRICE Hesitation
    const pricePatterns: Array<{ regex: RegExp; phrase: string }> = [
      { regex: /\b(too\s+expensive|very\s+expensive|pretty\s+expensive|a\s+bit\s+expensive|quite\s+expensive)\b/i, phrase: 'too expensive' },
      { regex: /\b(too\s+costly|very\s+costly|a\s+bit\s+costly|quite\s+costly)\b/i, phrase: 'too costly' },
      { regex: /\b(too\s+pricy|too\s+pricey|a\s+bit\s+pricier|a\s+bit\s+pricey)\b/i, phrase: 'pricey' },
      { regex: /\b(can\s+you\s+make\s+it\s+cheaper|make\s+it\s+cheaper|any\s+cheaper|cheaper\s+price)\b/i, phrase: 'make it cheaper' },
      { regex: /\b(any\s+(discount|discounts)|give\s+me\s+a\s+discount|have\s+any\s+discount|is\s+there\s+a\s+discount)\b/i, phrase: 'discount request' },
      { regex: /\b(any\s+(offer|offers|deals?)|is\s+there\s+an\s+offer|special\s+offer|best\s+deal)\b/i, phrase: 'offer request' },
      { regex: /\b(above\s+(my\s+)?budget|out\s+of\s+(my\s+)?budget|over\s+(my\s+)?budget|beyond\s+(my\s+)?budget|exceeds\s+(my\s+)?budget)\b/i, phrase: 'above budget' },
      { regex: /\b(can'?t\s+afford|cannot\s+afford|hard\s+to\s+afford|tight\s+budget)\b/i, phrase: 'cannot afford' },
      { regex: /\b(lower\s+the\s+price|lower\s+price|reduce\s+the\s+price|price\s+is\s+(too\s+)?high)\b/i, phrase: 'price too high' },
      { regex: /\b(price\s+reduction|reduced\s+price|any\s+reduction|reduce\s+(the\s+)?price|is\s+there\s+(any\s+|a\s+)?(price\s+reduction|reduced\s+price))\b/i, phrase: 'price reduction' },
      { regex: /\b(is\s+that\s+the\s+best\s+price|best\s+price\s+possible|any\s+promo|promo\s+code|coupon)\b/i, phrase: 'promo or best price' },
      { regex: /\b(i\s+like\s+it\s+but\s+it'?s\s+(costly|expensive|pricey|a\s+lot))\b/i, phrase: 'like it but costly' },
    ];

    for (const item of pricePatterns) {
      if (item.regex.test(lower)) {
        return {
          type: 'PRICE',
          confidence: 0.95,
          triggerPhrase: item.phrase,
          rawText,
        };
      }
    }

    // 5. Detection Category B: VALUE Hesitation
    const valuePatterns: Array<{ regex: RegExp; phrase: string }> = [
      { regex: /\b(is\s+it\s+worth\s+the\s+price|is\s+it\s+worth\s+it|worth\s+the\s+money|worth\s+buying)\b/i, phrase: 'worth the price' },
      { regex: /\b(why\s+should\s+i\s+pay\s+(this\s+much|so\s+much|more))\b/i, phrase: 'why pay this much' },
      { regex: /\b(why\s+is\s+it\s+so\s+expensive|does\s+it\s+justify\s+the\s+cost|is\s+it\s+justified)\b/i, phrase: 'justify cost' },
      { regex: /\b(is\s+the\s+extra\s+money\s+worth\s+it|value\s+for\s+money)\b/i, phrase: 'value for money' },
    ];

    for (const item of valuePatterns) {
      if (item.regex.test(lower)) {
        return {
          type: 'VALUE',
          confidence: 0.9,
          triggerPhrase: item.phrase,
          rawText,
        };
      }
    }

    // 6. Detection Category C: UNCERTAINTY Hesitation
    const uncertaintyPatterns: Array<{ regex: RegExp; phrase: string }> = [
      { regex: /\b(i\s+am\s+not\s+sure|i'?m\s+not\s+sure|not\s+sure|not\s+completely\s+sure|i\s+can'?t\s+decide|cannot\s+decide)\b/i, phrase: 'not sure' },
      { regex: /\b(having\s+second\s+thoughts|hesitating|still\s+thinking|thinking\s+about\s+it|need\s+to\s+think)\b/i, phrase: 'second thoughts' },
      { regex: /\b(not\s+convinced|not\s+really\s+convinced|torn\s+between)\b/i, phrase: 'not convinced' },
      { regex: /\b(which\s+one\s+should\s+i\s+choose|help\s+me\s+decide)\b/i, phrase: 'indecisive' },
    ];

    for (const item of uncertaintyPatterns) {
      if (item.regex.test(lower)) {
        return {
          type: 'UNCERTAINTY',
          confidence: 0.85,
          triggerPhrase: item.phrase,
          rawText,
        };
      }
    }

    // 7. Detection Category D: ABANDONMENT
    const abandonmentPatterns: Array<{ regex: RegExp; phrase: string }> = [
      { regex: /\b(not\s+buying\s+today|maybe\s+later|leaving|i'?ll\s+pass|forget\s+it)\b/i, phrase: 'not buying today' },
      { regex: /\b(won'?t\s+buy|not\s+interested\s+anymore|no\s+thanks|never\s+mind)\b/i, phrase: 'declining' },
      { regex: /\b(too\s+much\s+money,\s+i'?ll\s+leave|closing\s+the\s+tab|exit)\b/i, phrase: 'leaving store' },
    ];

    for (const item of abandonmentPatterns) {
      if (item.regex.test(lower)) {
        return {
          type: 'ABANDONMENT',
          confidence: 0.9,
          triggerPhrase: item.phrase,
          rawText,
        };
      }
    }

    // 8. Check budget constraints in state
    if (state?.budget?.max && state.discussedProducts && state.discussedProducts.length > 0) {
      const topProd = state.discussedProducts[0];
      if (topProd && topProd.price > state.budget.max * 1.15) {
        // Product is >15% over explicit user budget
        if (/\b(price|budget|cost|expensive)\b/i.test(lower)) {
          return {
            type: 'PRICE',
            confidence: 0.85,
            triggerPhrase: 'exceeds budget in state',
            rawText,
          };
        }
      }
    }

    return {
      type: 'NONE',
      confidence: 0,
      rawText,
    };
  }
}

export const hesitationDetectorService = new HesitationDetectorService();
