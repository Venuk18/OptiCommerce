import {
  DissatisfactionDetectionResult,
  DissatisfactionReason,
} from '../../types/intent.types';
import {
  ConversationState,
  DiscussedProduct,
} from '../../types/recommendation.types';

const KNOWN_BRANDS = [
  'lenovo',
  'hp',
  'dell',
  'apple',
  'samsung',
  'asus',
  'acer',
  'sony',
  'boat',
  'noise',
  'zebronics',
  'bose',
  'jbl',
  'sennheiser',
  'logitech',
  'oneplus',
  'realme',
  'xiaomi',
  'zenaudio',
  'bassmaster',
  'aurasound',
  'novabook',
  'alphavision',
  'fastcharge',
  'google',
  'microsoft',
];

export class DissatisfactionDetectorService {
  /**
   * Detects customer dissatisfaction from natural language and classifies the reason.
   * Runs deterministically with ZERO Gemini calls for high accuracy, speed, and cost efficiency.
   */
  public detectDissatisfaction(
    query: string,
    state?: ConversationState,
    discussedProducts?: DiscussedProduct[]
  ): DissatisfactionDetectionResult {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        isDissatisfied: false,
        reason: null,
        confidence: 0,
      };
    }

    const lower = trimmed.toLowerCase();
    const effectiveDiscussed = discussedProducts || state?.discussedProducts || [];
    const hasPriorContext = Boolean(
      state && (state.category || state.budget?.max || effectiveDiscussed.length > 0)
    );

    // 1. Check if user is answering a pending clarification question
    if (state?.pendingClarification || state?.stage === 'CLARIFYING') {
      return this.resolveClarificationAnswer(trimmed, state, effectiveDiscussed);
    }

    // Guard: Queries that are product questions, comparisons, or informative inquiries are NOT dissatisfaction
    const isQuestionOrComparison =
      /^(does\s+|is\s+|how\s+|why\s+|tell\s+me\s+|which\s+|compare\s+|what\s+)/i.test(trimmed) ||
      /\b(compare|versus|vs|difference\s+between|which\s+(?:one\s+)?(?:is\s+better|has\s+the\s+best))\b/i.test(trimmed) ||
      (/\?$/.test(trimmed) && !/\b(cheaper|why\s+so\s+expensive)\b/i.test(trimmed));

    if (isQuestionOrComparison) {
      return {
        isDissatisfied: false,
        reason: null,
        confidence: 0,
      };
    }

    // Guard: Dissatisfaction with previous recommendations requires prior recommendations or context
    if (!hasPriorContext && effectiveDiscussed.length === 0) {
      return {
        isDissatisfied: false,
        reason: null,
        confidence: 0,
      };
    }

    // 2. Clear Reason Detection: Price
    // Examples: "These are too expensive", "Too costly", "Cheaper please", "Show me cheaper ones", "I need something cheaper"
    const priceDissatisfactionPattern =
      /\b(too\s+(expensive|costly|pricier|high)|costs?\s+too\s+much|cheaper(\s+please|\s+ones?)?|lower\s+price|more\s+affordable|less\s+expensive|can't\s+afford|out\s+of\s+(my\s+)?budget|over\s+(my\s+)?budget|budget-friendly|price\s+is\s+too\s+high)\b/i;

    const isPriceDissatisfied =
      priceDissatisfactionPattern.test(lower) ||
      (/\b(expensive|costly)\b/i.test(lower) && /\b(these|this|options?|products?|they)\b/i.test(lower));

    if (isPriceDissatisfied) {
      const explicitMax = this.extractExplicitBudget(trimmed);
      let refinedMax = explicitMax;

      if (!refinedMax && effectiveDiscussed.length > 0) {
        // Refine price relative to previously shown products
        const minDiscussedPrice = Math.min(...effectiveDiscussed.map((p) => p.price));
        // Target a budget below the minimum previously shown, with a sensible step
        refinedMax = Math.max(1000, Math.floor(minDiscussedPrice * 0.85));
      }

      return {
        isDissatisfied: true,
        reason: 'PRICE',
        confidence: 0.95,
        extractedConstraint: {
          maxPrice: refinedMax,
          addedPreferences: ['budget-friendly'],
        },
      };
    }

    // 3. Clear Reason Detection: Brand exclusion / rejection
    // Examples: "I don't like Lenovo", "I don't want Lenovo", "No HP", "I don't like this brand", "Avoid Samsung"
    const brandRejectionPattern =
      /\b(don't\s+(?:like|want)\s+(?:this\s+brand|the\s+brand)|hate\s+this\s+brand|different\s+brand|not\s+this\s+brand)\b/i;
    const explicitBrandExclusion =
      /\b(?:don't\s+(?:like|want)|no|avoid|hate|not)\s+([a-z0-9]+)\b/i;

    if (brandRejectionPattern.test(lower)) {
      // Look up brand of focused or first discussed product if available
      const brandToExclude = effectiveDiscussed[0]?.name ? this.extractBrand(effectiveDiscussed[0].name) : undefined;
      return {
        isDissatisfied: true,
        reason: 'BRAND',
        confidence: 0.9,
        extractedConstraint: {
          excludedBrand: brandToExclude,
        },
      };
    }

    const brandMatch = lower.match(explicitBrandExclusion);
    if (brandMatch) {
      const candidateBrand = brandMatch[1].toLowerCase();
      const allBrands = new Set([
        ...KNOWN_BRANDS,
        ...effectiveDiscussed.map((p) => this.extractBrand(p.name)?.toLowerCase()).filter(Boolean),
      ]);
      const nonBrandWords = ['this', 'that', 'these', 'any', 'it', 'them', 'the', 'more', 'a', 'an', 'option', 'options'];

      if (!nonBrandWords.includes(candidateBrand) && (allBrands.has(candidateBrand) || candidateBrand.length > 2)) {
        return {
          isDissatisfied: true,
          reason: 'BRAND',
          confidence: 0.95,
          extractedConstraint: {
            excludedBrand: candidateBrand,
          },
        };
      }
    }

    // 4. Clear Reason Detection: Performance
    // Examples: "I need something more powerful", "I want something faster", "Too slow", "Better performance"
    if (
      /\b(more\s+powerful|faster|better\s+performance|too\s+slow|higher\s+speed|more\s+speed|better\s+processor|more\s+ram)\b/i.test(
        lower
      )
    ) {
      return {
        isDissatisfied: true,
        reason: 'PERFORMANCE',
        confidence: 0.92,
        extractedConstraint: {
          addedPreferences: ['high performance'],
        },
      };
    }

    // 5. Clear Reason Detection: Feature
    // Examples: "I want better battery", "I need longer battery", "With ANC", "Needs noise cancellation"
    if (
      /\b(better\s+battery|longer\s+battery|more\s+battery|battery\s+life|noise\s+cancellation|anc|touchscreen|backlit)\b/i.test(
        lower
      )
    ) {
      const addedPreferences: string[] = [];
      if (/\bbattery\b/i.test(lower)) addedPreferences.push('good battery life');
      if (/\b(noise\s+cancellation|anc)\b/i.test(lower)) addedPreferences.push('active noise cancellation');
      if (/\btouchscreen\b/i.test(lower)) addedPreferences.push('touchscreen');

      return {
        isDissatisfied: true,
        reason: 'FEATURE',
        confidence: 0.92,
        extractedConstraint: {
          addedPreferences,
        },
      };
    }

    // 6. Clear Reason Detection: Size / Portability
    // Examples: "I want a smaller laptop", "Too bulky", "Too big", "Something lighter"
    if (
      /\b(smaller(\s+laptop)?|too\s+(big|bulky|heavy)|something\s+lighter|more\s+portable|compact)\b/i.test(
        lower
      )
    ) {
      return {
        isDissatisfied: true,
        reason: 'SIZE',
        confidence: 0.9,
        extractedConstraint: {
          addedPreferences: ['lightweight', 'compact'],
        },
      };
    }

    // 7. Clear Reason Detection: Use Case
    // Examples: "I need something better for gaming", "Not good for coding", "Need it for video editing"
    if (
      /\b(better\s+for\s+(gaming|coding|editing|office|travel|running|gym)|not\s+good\s+for\s+(gaming|coding|editing))\b/i.test(
        lower
      )
    ) {
      const useCaseMatch = lower.match(
        /\b(?:better\s+for|not\s+good\s+for)\s+(gaming|coding|editing|office|travel|running|gym)\b/i
      );
      const useCase = useCaseMatch ? useCaseMatch[1].toLowerCase() : undefined;
      return {
        isDissatisfied: true,
        reason: 'USE_CASE',
        confidence: 0.9,
        extractedConstraint: {
          useCase,
        },
      };
    }

    // 8. General Dissatisfaction with UNKNOWN Reason
    // Examples: "I don't like these", "These aren't good", "None of these work", "I'm not interested",
    // "I don't want any of these", "Something else", "Show me something else", "None of these", "Not feeling these"
    const genericDissatisfactionPattern =
      /\b(i\s+don't\s+like\s+(these|this|any)|these\s+aren't\s+good|these\s+are\s+not\s+good|none\s+of\s+these(\s+work)?|i'm\s+not\s+interested|i\s+don't\s+want\s+(any\s+of\s+these|these)|not\s+what\s+i('m|\s+am)\s+looking\s+for|something\s+else|show\s+me\s+something\s+else|show\s+(different|other)\s+options?|not\s+feeling\s+these|dislike\s+these|these\s+don't\s+(work|fit)|not\s+for\s+me)\b/i;

    if (genericDissatisfactionPattern.test(lower)) {
      const clarification = this.generateTargetedClarification(state);
      return {
        isDissatisfied: true,
        reason: 'UNKNOWN',
        confidence: 0.95,
        suggestedClarificationQuestion: clarification.question,
        clarificationOptions: clarification.options,
      };
    }

    // Default: Not a dissatisfaction reaction
    return {
      isDissatisfied: false,
      reason: null,
      confidence: 0,
    };
  }

  /**
   * Resolves a customer's answer to a pending clarification question.
   */
  public resolveClarificationAnswer(
    query: string,
    state?: ConversationState,
    discussedProducts?: DiscussedProduct[]
  ): DissatisfactionDetectionResult {
    const lower = query.toLowerCase().trim();
    const effectiveDiscussed = discussedProducts || state?.discussedProducts || [];

    // Answer is "Price" / "cheaper" / explicit budget
    if (
      /\b(price|cheaper|cost|budget|affordable|less\s+money)\b/i.test(lower) ||
      /\b(\d+k?|\d{4,6})\b/i.test(lower)
    ) {
      const explicitMax = this.extractExplicitBudget(query);
      let refinedMax = explicitMax;
      if (!refinedMax && effectiveDiscussed.length > 0) {
        const minPrice = Math.min(...effectiveDiscussed.map((p) => p.price));
        refinedMax = Math.max(1000, Math.floor(minPrice * 0.85));
      }

      // Check if user also specified a brand, e.g. "I need a cheaper Lenovo one"
      let preferredBrand: string | undefined;
      for (const b of KNOWN_BRANDS) {
        if (new RegExp(`\\b${b}\\b`, 'i').test(lower)) {
          preferredBrand = b;
          break;
        }
      }

      return {
        isDissatisfied: true,
        reason: 'PRICE',
        confidence: 0.95,
        extractedConstraint: {
          maxPrice: refinedMax,
          preferredBrand,
          addedPreferences: ['budget-friendly'],
        },
      };
    }

    // Answer is "Performance"
    if (/\b(performance|speed|power|faster|powerful|processor|ram)\b/i.test(lower)) {
      return {
        isDissatisfied: true,
        reason: 'PERFORMANCE',
        confidence: 0.95,
        extractedConstraint: {
          addedPreferences: ['high performance'],
        },
      };
    }

    // Answer is "Brand"
    if (/\b(brand|make|company|manufacturer)\b/i.test(lower)) {
      let preferredBrand: string | undefined;
      for (const b of KNOWN_BRANDS) {
        if (new RegExp(`\\b${b}\\b`, 'i').test(lower)) {
          preferredBrand = b;
          break;
        }
      }
      return {
        isDissatisfied: true,
        reason: 'BRAND',
        confidence: 0.9,
        extractedConstraint: {
          preferredBrand,
        },
      };
    }

    // Answer is "Features" / Feature question (e.g. "I want better battery", "Noise cancellation")
    if (
      /\b(features?|battery|anc|noise\s+cancellation|comfort|portability|screen|display)\b/i.test(lower)
    ) {
      const addedPreferences: string[] = [];
      if (/\bbattery\b/i.test(lower)) addedPreferences.push('good battery life');
      if (/\b(anc|noise\s+cancellation)\b/i.test(lower)) addedPreferences.push('active noise cancellation');
      if (/\bcomfort\b/i.test(lower)) addedPreferences.push('comfortable');
      if (/\bportability\b/i.test(lower)) addedPreferences.push('lightweight');

      return {
        isDissatisfied: true,
        reason: 'FEATURE',
        confidence: 0.95,
        extractedConstraint: {
          addedPreferences: addedPreferences.length > 0 ? addedPreferences : ['features'],
        },
      };
    }

    // Fallback: treat as general refinement
    return {
      isDissatisfied: true,
      reason: 'OTHER',
      confidence: 0.8,
      extractedConstraint: {
        addedPreferences: [query.trim()],
      },
    };
  }

  /**
   * Generates a context-aware, targeted clarification question.
   * Asks exactly ONE question with specific, category-appropriate options.
   */
  public generateTargetedClarification(state?: ConversationState): {
    question: string;
    options: string[];
  } {
    const category = (state?.category || '').toLowerCase();
    const useCase = (state?.useCase || '').toLowerCase();

    // Context: Gaming Laptop
    if (category.includes('laptop') && (useCase.includes('gaming') || state?.preferences?.includes('gaming'))) {
      return {
        question: 'Got it. What would you like to improve — price, gaming performance, or portability?',
        options: ['price', 'gaming performance', 'portability'],
      };
    }

    // Context: Coding Laptop
    if (category.includes('laptop') && (useCase.includes('coding') || useCase.includes('college'))) {
      return {
        question: 'Got it. What would you like to change — price, performance, brand, or portability?',
        options: ['price', 'performance', 'brand', 'portability'],
      };
    }

    // Context: Audio / Headphones / Earbuds
    if (category.includes('headphone') || category.includes('earbud') || category.includes('audio')) {
      return {
        question: 'Got it. What matters most to change — price, comfort, or noise cancellation?',
        options: ['price', 'comfort', 'noise cancellation'],
      };
    }

    // General default clarification
    return {
      question: 'Got it. What would you like to change — price, performance, brand, or features?',
      options: ['price', 'performance', 'brand', 'features'],
    };
  }

  /**
   * Extracts explicit numerical budget from user query if present.
   */
  public extractExplicitBudget(query: string): number | undefined {
    // Under 60000, under 60k, below 50000, max 70000
    const matchK = query.match(/\b(?:under|below|less\s+than|max|upto|within|budget\s+(?:of|is)?)\s*₹?\s*(\d+)\s*k\b/i);
    if (matchK) {
      return parseInt(matchK[1], 10) * 1000;
    }

    const matchFull = query.match(
      /\b(?:under|below|less\s+than|max|upto|within|budget\s+(?:of|is)?)\s*₹?\s*(\d{3,7})\b/i
    );
    if (matchFull) {
      return parseInt(matchFull[1], 10);
    }

    // Direct ₹60000 / 60000 when query is short (e.g. "Under 60000")
    const matchSimple = query.match(/^(?:under\s+)?₹?\s*(\d{4,7})$/i);
    if (matchSimple) {
      return parseInt(matchSimple[1], 10);
    }

    return undefined;
  }

  /**
   * Extracts brand name from product name or text.
   */
  private extractBrand(text: string): string | undefined {
    const lower = text.toLowerCase();
    for (const b of KNOWN_BRANDS) {
      if (lower.includes(b)) {
        return b;
      }
    }
    return undefined;
  }
}

export const dissatisfactionDetectorService = new DissatisfactionDetectorService();
