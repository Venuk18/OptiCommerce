import { Type } from '@google/genai';
import {
  CustomerIntent,
  DissatisfactionDetectionResult,
  IntentExtractionResult,
  IntentMode,
  ReferenceResolutionResult,
} from '../../types/intent.types';
import { ConversationState, ConversationMessageHistory } from '../../types/recommendation.types';
import { referenceResolverService } from './reference-resolver.service';
import { dissatisfactionDetectorService } from './dissatisfaction-detector.service';
import { getGeminiClient } from './gemini.client';
import { aiProviderOrchestrator } from './providers/ai-provider.orchestrator';
import { aiConfig } from '../../config/ai.config';

export interface IntentExtractionContext {
  state?: ConversationState;
  history?: ConversationMessageHistory[];
  focusedProductId?: string;
}

const KNOWN_BRANDS = [
  'Sony', 'Apple', 'Samsung', 'ZenAudio', 'BassMaster', 'Bose', 'Dell', 'HP', 
  'Lenovo', 'NovaBook', 'AlphaVision', 'FastCharge', 'AuraSound', 'Logitech', 
  'Boat', 'boAt', 'JBL', 'Sennheiser', 'Anker', 'Asus', 'Acer', 'OnePlus', 
  'Google', 'Nothing', 'Xiaomi', 'Realme', 'Marshall', 'Audio-Technica'
];

const KNOWN_CATEGORIES = [
  { keywords: ['earbuds', 'earbud', 'tws', 'airpods'], name: 'earbuds' },
  { keywords: ['headphones', 'headphone', 'headset', 'over-ear', 'on-ear'], name: 'headphones' },
  { keywords: ['earphones', 'earphone', 'in-ear', 'neckband'], name: 'earphones' },
  { keywords: ['speaker', 'speakers', 'soundbar', 'bluetooth speaker'], name: 'speakers' },
  { keywords: ['audio', 'sound'], name: 'audio' },
  { keywords: ['laptop sleeve', 'laptop bag', 'sleeve', 'carrying case'], name: 'sleeves' },
  { keywords: ['laptop', 'laptops', 'notebook', 'macbook'], name: 'laptops' },
  { keywords: ['camera', 'cameras', 'mirrorless', 'dslr'], name: 'cameras' },
  { keywords: ['usb-c hub', 'usb hub', 'hub', 'dock', 'docking station'], name: 'hubs' },
  { keywords: ['charger', 'chargers', 'charging station', 'adapter', 'gan charger'], name: 'chargers' },
  { keywords: ['monitor', 'monitors', 'display', 'screen'], name: 'monitors' },
  { keywords: ['keyboard', 'keyboards', 'mechanical keyboard'], name: 'keyboards' },
  { keywords: ['wireless mouse', 'mouse', 'mice', 'trackpad'], name: 'mice' },
  { keywords: ['smartwatch', 'smart watch', 'fitness band', 'watch', 'tracker'], name: 'smartwatches' },
  { keywords: ['phone case', 'case', 'cover', 'mobile cover', 'protective case'], name: 'cases' },
  { keywords: ['lamp', 'task lamp', 'desk light', 'light'], name: 'lighting' },
  { keywords: ['desk', 'desk mat', 'ergonomic setup', 'stand'], name: 'accessories' },
  { keywords: ['smartphone', 'phone', 'mobile'], name: 'smartphones' },
  { keywords: ['tablet', 'ipad'], name: 'tablets' }
];

const USE_CASE_PATTERNS = [
  { pattern: /\b(for\s+college|for\s+school|for\s+university|for\s+students?|college|study)\b/i, value: 'college' },
  { pattern: /\b(for\s+gaming|gaming\s+setup|gamers?)\b/i, value: 'gaming' },
  { pattern: /\b(for\s+office|for\s+work|business|working)\b/i, value: 'office work' },
  { pattern: /\b(for\s+gym|for\s+running|for\s+workout|for\s+sports?|exercise)\b/i, value: 'gym & fitness' },
  { pattern: /\b(for\s+coding|for\s+programming|developer|software)\b/i, value: 'coding' },
  { pattern: /\b(for\s+travel|traveling|commuting|flight)\b/i, value: 'travel' },
];

const PREFERENCE_PATTERNS = [
  { pattern: /\b(strong\s+bass|extra\s+bass|deep\s+bass|punchy\s+bass|heavy\s+bass|bass\s+boost|more\s+bass|better\s+bass)\b/i, value: 'strong bass' },
  { pattern: /\b(good\s+battery|long\s+battery|battery\s+life|extended\s+battery|40h|50h|60h|more\s+battery|better\s+battery|best\s+battery)\b/i, value: 'good battery life' },
  { pattern: /\b(noise\s+cancellation|noise\s+cancelling|anc|active\s+noise\s+cancellation|with\s+anc)\b/i, value: 'active noise cancellation' },
  { pattern: /\b(wireless|bluetooth|cordless|true\s+wireless)\b/i, value: 'wireless' },
  { pattern: /\b(wired|3\.5mm|aux)\b/i, value: 'wired' },
  { pattern: /\b(waterproof|water\s+resistant|ipx\d|sweatproof)\b/i, value: 'waterproof' },
  { pattern: /\b(fast\s+charg(ing|e)|quick\s+charge|gan)\b/i, value: 'fast charging' },
  { pattern: /\b(lightweight|lighter|compact|featherweight|thin|slim|portable|travel-friendly)\b/i, value: 'lightweight' },
  { pattern: /\b(gaming|low\s+latency|rgb)\b/i, value: 'gaming' },
  { pattern: /\b(studio|audiophile|dj|monitoring|neutral\s+sound)\b/i, value: 'studio monitoring' },
  { pattern: /\b(ergonomic|comfort|comfortable)\b/i, value: 'ergonomic' },
  { pattern: /\b(mechanical|rgb\s+backlit|hot-swappable)\b/i, value: 'mechanical' },
  { pattern: /\b(4k|hdr|144hz|high\s+refresh|oled|ips)\b/i, value: 'high display quality' },
  { pattern: /\b(usb-c|type-c|thunderbolt)\b/i, value: 'type-c connectivity' },
  { pattern: /\b(cheaper|lower\s+cost|more\s+affordable|budget-friendly|budget\s+friendly)\b/i, value: 'budget-friendly' },
  { pattern: /\b(more\s+powerful|faster|high\s+performance)\b/i, value: 'high performance' },
  { pattern: /\b(white|matte\s+white|pearl\s+white)\b/i, value: 'white color' },
  { pattern: /\b(black|matte\s+black)\b/i, value: 'black color' }
];

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 
  'they', 'what', 'which', 'who', 'this', 'that', 'these', 'those', 'am', 'is', 
  'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 
  'does', 'did', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 
  'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'between', 'into', 
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 
  'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 
  'just', 'don', 'should', 'now', 'need', 'want', 'looking', 'look', 'find', 
  'buy', 'search', 'get', 'give', 'show', 'please', 'suggest', 'recommend', 
  'budget', 'price', 'rupees', 'inr', 'rs', 'cost', 'under', 'below', 'less', 
  'above', 'more', 'between', 'around', 'upto', 'maximum', 'minimum', 'max', 'min'
]);

export class IntentExtractorService {
  /**
   * Main entry point to extract structured shopping intent from customer query,
   * fully aware of previous conversationState and recent chat context.
   */
  async extractIntent(
    query: string,
    context?: IntentExtractionContext
  ): Promise<IntentExtractionResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return {
        intent: this.createEmptyIntent(),
        source: 'fallback',
        mode: 'NEW_REQUEST',
      };
    }

    const prevState = context?.state;
    const discussedProducts = prevState?.discussedProducts || [];
    const focusedId = context?.focusedProductId || prevState?.selectedProductId || null;

    // 1. Deterministic Reference Resolution against discussed products
    const refResult = referenceResolverService.resolveReferences(
      trimmedQuery,
      discussedProducts,
      focusedId
    );

    // 2. Dissatisfaction detection against conversation state and discussed products (Phase 3)
    const dissatResult = dissatisfactionDetectorService.detectDissatisfaction(
      trimmedQuery,
      prevState,
      discussedProducts
    );

    // 3. Detect Intent Mode
    const mode = this.detectIntentMode(trimmedQuery, prevState, refResult, dissatResult);

    // 4. Fast path: Direct product references or comparisons about existing options
    // When the customer is inquiring about or comparing products already in memory,
    // we resolve deterministically with ZERO Gemini calls.
    if (mode === 'PRODUCT_REFERENCE' || mode === 'COMPARISON_REQUEST' || mode === 'PRODUCT_QUESTION') {
      if (refResult.mode === 'invalid') {
        const intent = this.mergeWithPreviousState(this.createEmptyIntent(), mode, prevState, trimmedQuery);
        intent.targetProductPositions = refResult.referencedPositions;
        intent.mode = mode;
        return {
          intent,
          source: 'context_merged',
          mode,
          referenceResolution: refResult,
        };
      }

      if (refResult.resolved) {
        const baseIntent = this.extractWithFallback(trimmedQuery);
        const mergedIntent = this.mergeWithPreviousState(baseIntent, mode, prevState, trimmedQuery);
        mergedIntent.targetProductPositions = refResult.referencedPositions;
        mergedIntent.mode = mode;
        if (refResult.comparisonAttribute) {
          mergedIntent.comparisonAttributes = [refResult.comparisonAttribute];
        }
        return {
          intent: mergedIntent,
          source: 'context_merged',
          mode,
          referenceResolution: refResult,
        };
      }
    }

    // 5. Fast path: Dissatisfaction or Clarification Answer (Phase 3)
    // Runs deterministically with ZERO Gemini calls for speed, reliability, and zero cost.
    if (mode === 'DISSATISFACTION' || mode === 'CLARIFICATION_ANSWER') {
      const baseIntent = this.extractWithFallback(trimmedQuery);

      if (dissatResult.extractedConstraint?.maxPrice) {
        baseIntent.maxPrice = dissatResult.extractedConstraint.maxPrice;
      }
      if (dissatResult.extractedConstraint?.minPrice) {
        baseIntent.minPrice = dissatResult.extractedConstraint.minPrice;
      }
      if (dissatResult.extractedConstraint?.preferredBrand) {
        baseIntent.brand = dissatResult.extractedConstraint.preferredBrand;
      }
      if (dissatResult.extractedConstraint?.excludedBrand) {
        baseIntent.exclusions = [dissatResult.extractedConstraint.excludedBrand];
      }
      if (dissatResult.extractedConstraint?.addedPreferences) {
        baseIntent.preferences = Array.from(
          new Set([...baseIntent.preferences, ...dissatResult.extractedConstraint.addedPreferences])
        );
      }
      if (dissatResult.extractedConstraint?.useCase) {
        baseIntent.useCase = dissatResult.extractedConstraint.useCase;
      }

      // Add currently discussed products to rejectedProductIds
      const newRejected = Array.from(
        new Set([...(prevState?.rejectedProducts || []), ...discussedProducts.map((p) => p.id)])
      );
      baseIntent.rejectedProductIds = newRejected;

      const mergedIntent = this.mergeWithPreviousState(baseIntent, mode, prevState, trimmedQuery);
      mergedIntent.mode = mode;

      return {
        intent: mergedIntent,
        source: 'context_merged',
        mode,
        referenceResolution: refResult,
        dissatisfactionResult: dissatResult,
      };
    }

    // 6. Extraction for NEW_REQUEST or FOLLOW_UP_REFINEMENT
    let rawIntent: CustomerIntent | null = null;
    let source: 'ai' | 'fallback' | 'context_merged' = 'fallback';

    try {
      const aiIntent = await this.extractWithAI(trimmedQuery);
      if (aiIntent) {
        const validated = this.validateAndSanitizeIntent(aiIntent);
        if (validated) {
          rawIntent = validated;
          source = 'ai';
        }
      }
    } catch (err) {
      // Safe silent fallback when AI fails or times out
    }

    if (!rawIntent) {
      rawIntent = this.extractWithFallback(trimmedQuery);
      source = 'fallback';
    }

    // 7. Deterministic State Merging: Combine previous constraints with new intent
    const mergedIntent = this.mergeWithPreviousState(rawIntent, mode, prevState, trimmedQuery);
    mergedIntent.mode = mode;
    if (refResult.resolved) {
      mergedIntent.targetProductPositions = refResult.referencedPositions;
    }

    return {
      intent: mergedIntent,
      source: prevState ? 'context_merged' : source,
      mode,
      referenceResolution: refResult,
      dissatisfactionResult: dissatResult,
    };
  }

  /**
   * Classifies user query into intent modes:
   * - NEW_REQUEST
   * - FOLLOW_UP_REFINEMENT
   * - PRODUCT_QUESTION
   * - PRODUCT_REFERENCE
   * - COMPARISON_REQUEST
   * - DISSATISFACTION
   * - CLARIFICATION_ANSWER
   */
  public detectIntentMode(
    query: string,
    prevState?: ConversationState,
    refResult?: ReferenceResolutionResult,
    dissatResult?: DissatisfactionDetectionResult
  ): IntentMode {
    const lower = query.toLowerCase().trim();

    // Invalid position requested (e.g. "fourth one" when 3 products exist)
    if (refResult?.mode === 'invalid') {
      return 'PRODUCT_REFERENCE';
    }

    // Explicit comparison patterns
    const comparisonPattern = /\b(compare|versus|vs|difference\s+between|which\s+(one\s+)?(is\s+better|should\s+i\s+buy|has\s+(the\s+)?best|is\s+cheaper|has\s+better))\b/i;
    if (refResult?.mode === 'multiple' || comparisonPattern.test(lower)) {
      return 'COMPARISON_REQUEST';
    }

    // Questions about specific product features
    const questionPattern = /\b(does\s+(it|this|that|the|option)|why\s+is|how\s+is|is\s+(it|this|that|the|option)|have\s+anc|has\s+anc|how\s+much\s+is|battery\s+life|warranty|waterproof|tell\s+me\s+about)\b/i;
    if (refResult?.resolved) {
      if (questionPattern.test(lower)) {
        return 'PRODUCT_QUESTION';
      }
      return 'PRODUCT_REFERENCE';
    }

    if (/\b(why\s+(this|that)\s+one|tell\s+me\s+about\s+(this|that)|is\s+(this|that)\s+good)\b/i.test(lower)) {
      return 'PRODUCT_REFERENCE';
    }

    // Pending clarification answer detection (Phase 3)
    if (prevState?.pendingClarification || prevState?.stage === 'CLARIFYING') {
      return 'CLARIFICATION_ANSWER';
    }

    // Dissatisfaction detection (Phase 3)
    const effectiveDissat = dissatResult || dissatisfactionDetectorService.detectDissatisfaction(
      query,
      prevState,
      prevState?.discussedProducts
    );
    if (effectiveDissat.isDissatisfied) {
      return 'DISSATISFACTION';
    }

    // Check if there is active prior state
    const hasPriorState = Boolean(
      prevState &&
        (prevState.category ||
          prevState.budget?.max ||
          (prevState.discussedProducts && prevState.discussedProducts.length > 0))
    );

    if (hasPriorState) {
      // Check if user is starting an entirely new shopping journey for a different category
      let newCategory: string | null = null;
      for (const cat of KNOWN_CATEGORIES) {
        if (cat.keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(lower))) {
          newCategory = cat.name;
          break;
        }
      }

      const isExplicitNewRequest = /\b(now\s+(show|find|search)|switch\s+to|look\s+for\s+a(n)?|i\s+(also\s+)?need\s+a(n)?|i\s+want\s+a(n)?|search\s+for\s+a(n)?)\b/i.test(lower);

      if (newCategory && prevState?.category && newCategory !== prevState.category && isExplicitNewRequest) {
        return 'NEW_REQUEST';
      }

      // Short follow-up modifications ("cheaper", "something lighter", "under 7000", "for college", etc.)
      return 'FOLLOW_UP_REFINEMENT';
    }

    return 'NEW_REQUEST';
  }

  /**
   * Deterministically merges prior conversation state with newly extracted intent.
   * Enforces constraint preservation and explicit override rules:
   * - New explicit budget overrides old budget
   * - New explicit category overrides old category
   * - New explicit useCase overrides old useCase
   * - Preferences are accumulated and deduplicated (with contradiction resolution)
   * - Prior constraints are preserved when not explicitly replaced
   * - Exclusions and rejected products are preserved and accumulated (Phase 3)
   */
  public mergeWithPreviousState(
    rawIntent: CustomerIntent,
    mode: IntentMode,
    prevState?: ConversationState,
    query?: string
  ): CustomerIntent {
    const rawUseCase = this.extractUseCase(query || '');

    if (!prevState || mode === 'NEW_REQUEST') {
      return {
        ...rawIntent,
        mode: 'NEW_REQUEST',
        useCase: rawUseCase || rawIntent.useCase || null,
      };
    }

    // 1. Budget: Explicit new budget overrides old. Otherwise preserve previous.
    const minPrice = rawIntent.minPrice !== null ? rawIntent.minPrice : (prevState.budget?.min ?? null);
    const maxPrice = rawIntent.maxPrice !== null ? rawIntent.maxPrice : (prevState.budget?.max ?? null);

    // 2. Category: Preserve existing category unless a new explicit one was provided
    const category = rawIntent.category || prevState.category || null;

    // 3. Brand: Explicit new brand wins, or preserve if present
    const brand = rawIntent.brand || null;

    // 4. Use Case: Explicit new use case wins, or preserve previous
    const useCase = rawUseCase || rawIntent.useCase || prevState.useCase || null;

    // 5. Preferences: Accumulate previous and new preferences
    let mergedPreferences = Array.from(
      new Set([...(prevState.preferences || []), ...(rawIntent.preferences || [])])
    );

    // Contradiction resolution
    if (rawIntent.preferences.includes('wired')) {
      mergedPreferences = mergedPreferences.filter((p) => p !== 'wireless');
    } else if (rawIntent.preferences.includes('wireless')) {
      mergedPreferences = mergedPreferences.filter((p) => p !== 'wired');
    }

    // 6. Keywords: Combine unique keywords
    const combinedKeywords = Array.from(new Set([...(rawIntent.keywords || [])]));
    if (category && !combinedKeywords.includes(category)) {
      combinedKeywords.unshift(category);
    }

    // 7. Exclusions: Accumulate previous exclusions and any new ones (Phase 3)
    const mergedExclusions = Array.from(
      new Set([...(prevState.exclusions || []), ...(rawIntent.exclusions || [])])
    );

    // 8. Rejected products: Accumulate previous and new rejected product IDs (Phase 3)
    const mergedRejected = Array.from(
      new Set([...(prevState.rejectedProducts || []), ...(rawIntent.rejectedProductIds || [])])
    );

    return {
      category,
      brand,
      minPrice,
      maxPrice,
      preferences: mergedPreferences,
      keywords: combinedKeywords.slice(0, 10),
      mode,
      useCase,
      exclusions: mergedExclusions,
      rejectedProductIds: mergedRejected,
    };
  }

  /**
   * Helper to extract use cases like college, gaming, office work, gym, travel, coding.
   */
  public extractUseCase(query: string): string | null {
    for (const item of USE_CASE_PATTERNS) {
      if (item.pattern.test(query)) {
        return item.value;
      }
    }
    return null;
  }

  /**
   * Calls AI using the quota-efficient multi-provider orchestrator (Groq -> Cerebras -> Gemini).
   */
  private async extractWithAI(query: string): Promise<any | null> {
    const result = await aiProviderOrchestrator.generateJson<any>(`Customer Query: "${query}"`, {
      operationName: 'intent extraction',
      systemInstruction: `You are an expert commerce shopping intent parser.
Your ONLY task is to extract structured shopping intent from a customer's query.

CRITICAL RULES:
1. ONLY extract values that are explicitly mentioned or directly implied by the customer's query.
2. DO NOT recommend products, DO NOT invent products, DO NOT invent prices, DO NOT generate discounts, DO NOT calculate revenue.
3. Use null for any field that cannot be determined from the query.
4. "minPrice": A non-negative number if a minimum budget/price is specified (e.g., "above 2000", "from 1000"), else null.
5. "maxPrice": A non-negative number if a maximum budget/price is specified (e.g., "under 5000", "below ₹3000", "budget 4000"), else null.
6. "category": The product category or type requested (e.g., "earbuds", "headphones", "laptop", "camera", "charger"), in lower-case singular form, or null if none.
7. "brand": The specific brand name requested (e.g., "Sony", "Apple", "ZenAudio"), or null if none.
8. "preferences": An array of feature/spec preferences requested (e.g., ["strong bass", "good battery life", "active noise cancellation"]).
9. "keywords": An array of important search keywords from the query (e.g., ["wireless", "earbuds", "bass"]). Maximum 10 items.
10. Return strictly structured JSON matching this schema:
{
  "category": string or null,
  "brand": string or null,
  "minPrice": number or null,
  "maxPrice": number or null,
  "preferences": string[],
  "keywords": string[]
}`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: 'The product category or type requested, or null if not mentioned.',
          },
          brand: {
            type: Type.STRING,
            description: 'Specific brand name requested, or null if not mentioned.',
          },
          minPrice: {
            type: Type.NUMBER,
            description: 'Minimum price or budget limit in currency units, or null if not mentioned.',
          },
          maxPrice: {
            type: Type.NUMBER,
            description: 'Maximum price or budget limit in currency units, or null if not mentioned.',
          },
          preferences: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: 'List of product features or quality preferences specified by the customer.',
          },
          keywords: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: 'List of relevant keywords extracted from the user query.',
          },
        },
        required: ['preferences', 'keywords'],
      },
      timeoutMs: 5000,
    });

    return result?.data || null;
  }

  /**
   * Calls Gemini using @google/genai SDK with structured output schema.
   */
  private async extractWithGemini(
    aiClient: ReturnType<typeof getGeminiClient>,
    query: string
  ): Promise<any | null> {
    if (!aiClient) return null;

    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('AI extraction timed out')), 5000)
    );

    const callPromise = (async () => {
      const response = await aiClient.models.generateContent({
        model: aiConfig.gemini.model || 'gemini-3.6-flash',
        contents: query,
        config: {
          systemInstruction: `You are an expert commerce shopping intent parser.
Your ONLY task is to extract structured shopping intent from a customer's query.

CRITICAL RULES:
1. ONLY extract values that are explicitly mentioned or directly implied by the customer's query.
2. DO NOT recommend products, DO NOT invent products, DO NOT invent prices, DO NOT generate discounts, DO NOT calculate revenue.
3. Use null for any field that cannot be determined from the query.
4. "minPrice": A non-negative number if a minimum budget/price is specified (e.g., "above 2000", "from 1000"), else null.
5. "maxPrice": A non-negative number if a maximum budget/price is specified (e.g., "under 5000", "below ₹3000", "budget 4000"), else null.
6. "category": The product category or type requested (e.g., "earbuds", "headphones", "laptop", "camera", "charger"), in lower-case singular form, or null if none.
7. "brand": The specific brand name requested (e.g., "Sony", "Apple", "ZenAudio"), or null if none.
8. "preferences": An array of feature/spec preferences requested (e.g., ["strong bass", "good battery life", "active noise cancellation"]).
9. "keywords": An array of important search keywords from the query (e.g., ["wireless", "earbuds", "bass"]). Maximum 10 items.
10. Return strictly structured JSON matching the provided schema.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: 'The product category or type requested, or null if not mentioned.',
              },
              brand: {
                type: Type.STRING,
                description: 'Specific brand name requested, or null if not mentioned.',
              },
              minPrice: {
                type: Type.NUMBER,
                description: 'Minimum price or budget limit in currency units, or null if not mentioned.',
              },
              maxPrice: {
                type: Type.NUMBER,
                description: 'Maximum price or budget limit in currency units, or null if not mentioned.',
              },
              preferences: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: 'List of product features or quality preferences specified by the customer.',
              },
              keywords: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: 'List of relevant keywords extracted from the user query.',
              },
            },
            required: ['preferences', 'keywords'],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) return null;

      return JSON.parse(responseText.trim());
    })();

    return Promise.race([callPromise, timeoutPromise]);
  }

  /**
   * Deterministic rule-based extractor used when Gemini is unavailable or invalid.
   */
  public extractWithFallback(query: string): CustomerIntent {
    const lowerQuery = query.toLowerCase();

    // 1. Extract Price Boundaries
    let minPrice: number | null = null;
    let maxPrice: number | null = null;

    // Helper to parse price string like "5000", "5,000", "5k"
    const parseNumber = (val: string): number | null => {
      if (!val) return null;
      const clean = val.replace(/,/g, '').trim().toLowerCase();
      if (clean.endsWith('k')) {
        const num = parseFloat(clean.slice(0, -1));
        return isNaN(num) ? null : Math.round(num * 1000);
      }
      const num = parseFloat(clean);
      return isNaN(num) || num < 0 ? null : Math.round(num);
    };

    // Range patterns: "between 2000 and 5000", "2000 to 5000", "2000 - 5000", "from 2000 to 5000"
    const rangeMatch = lowerQuery.match(
      /(?:between|from)?\s*(?:[₹$]|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?k?)\s*(?:and|to|-)\s*(?:[₹$]|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?k?)/i
    );
    if (rangeMatch) {
      const p1 = parseNumber(rangeMatch[1]);
      const p2 = parseNumber(rangeMatch[2]);
      if (p1 !== null && p2 !== null) {
        minPrice = Math.min(p1, p2);
        maxPrice = Math.max(p1, p2);
      }
    } else {
      // Max price patterns: "under 5000", "below ₹5000", "less than 5000", "max 5000", "upto 5000", "< 5000", "budget 5000"
      const maxMatch = lowerQuery.match(
        /(?:under|below|less\s+than|max(?:imum)?|upto|up\s+to|within|budget(?:\s+of)?|<|<=)\s*(?:[₹$]|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?k?)/i
      );
      if (maxMatch) {
        maxPrice = parseNumber(maxMatch[1]);
      }

      // Min price patterns: "above 2000", "over 2000", "more than 2000", "min 2000", "at least 2000", "> 2000"
      const minMatch = lowerQuery.match(
        /(?:above|over|more\s+than|min(?:imum)?|at\s+least|>|>=)\s*(?:[₹$]|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?k?)/i
      );
      if (minMatch) {
        minPrice = parseNumber(minMatch[1]);
      }

      // Standalone price indicator like "₹5000" if no other max/min was captured
      if (minPrice === null && maxPrice === null) {
        const standalonePrice = lowerQuery.match(/(?:[₹]|rs\.?|inr)\s*(\d+(?:,\d+)*(?:\.\d+)?k?)/i);
        if (standalonePrice) {
          maxPrice = parseNumber(standalonePrice[1]);
        }
      }
    }

    // Ensure minPrice <= maxPrice if both exist
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      const temp = minPrice;
      minPrice = maxPrice;
      maxPrice = temp;
    }

    // 2. Extract Category
    let category: string | null = null;
    for (const cat of KNOWN_CATEGORIES) {
      if (cat.keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(lowerQuery))) {
        category = cat.name;
        break;
      }
    }

    // 3. Extract Brand
    let brand: string | null = null;
    for (const b of KNOWN_BRANDS) {
      if (new RegExp(`\\b${b}\\b`, 'i').test(lowerQuery)) {
        brand = b;
        break;
      }
    }

    // 4. Extract Preferences
    const preferences: string[] = [];
    for (const pref of PREFERENCE_PATTERNS) {
      if (pref.pattern.test(query)) {
        if (!preferences.includes(pref.value)) {
          preferences.push(pref.value);
        }
      }
    }

    // 5. Extract Keywords
    // Tokenize query into words, strip non-alphanumerics, exclude stop words
    const rawTokens = query
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !STOP_WORDS.has(t));

    const keywords = Array.from(new Set(rawTokens)).slice(0, 10);

    return {
      category,
      brand,
      minPrice,
      maxPrice,
      preferences: preferences.slice(0, 10),
      keywords,
    };
  }

  /**
   * Validates and sanitizes Gemini output to ensure absolute type safety and adherence to constraints.
   */
  public validateAndSanitizeIntent(raw: any): CustomerIntent | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    // Validate and sanitize category
    let category: string | null = null;
    if (typeof raw.category === 'string' && raw.category.trim().length > 0) {
      const cleanCat = raw.category.trim().toLowerCase();
      if (cleanCat !== 'null' && cleanCat !== 'none' && cleanCat !== 'undefined') {
        const matchedKnown = KNOWN_CATEGORIES.find(cat =>
          cat.name.toLowerCase() === cleanCat ||
          cat.keywords.some(kw => kw.toLowerCase() === cleanCat)
        );
        category = matchedKnown ? matchedKnown.name : cleanCat;
      }
    }

    // Validate and sanitize brand
    let brand: string | null = null;
    if (typeof raw.brand === 'string' && raw.brand.trim().length > 0) {
      const cleanBrand = raw.brand.trim();
      if (cleanBrand.toLowerCase() !== 'null' && cleanBrand.toLowerCase() !== 'none' && cleanBrand.toLowerCase() !== 'undefined') {
        brand = cleanBrand;
      }
    }

    // Validate and sanitize minPrice
    let minPrice: number | null = null;
    if (typeof raw.minPrice === 'number' && !isNaN(raw.minPrice) && raw.minPrice >= 0) {
      minPrice = Math.round(raw.minPrice);
    } else if (typeof raw.minPrice === 'string') {
      const parsed = parseFloat(raw.minPrice.replace(/,/g, ''));
      if (!isNaN(parsed) && parsed >= 0) {
        minPrice = Math.round(parsed);
      }
    }

    // Validate and sanitize maxPrice
    let maxPrice: number | null = null;
    if (typeof raw.maxPrice === 'number' && !isNaN(raw.maxPrice) && raw.maxPrice >= 0) {
      maxPrice = Math.round(raw.maxPrice);
    } else if (typeof raw.maxPrice === 'string') {
      const parsed = parseFloat(raw.maxPrice.replace(/,/g, ''));
      if (!isNaN(parsed) && parsed >= 0) {
        maxPrice = Math.round(parsed);
      }
    }

    // Ensure minPrice <= maxPrice if both exist
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      const temp = minPrice;
      minPrice = maxPrice;
      maxPrice = temp;
    }

    // Validate and sanitize preferences array
    let preferences: string[] = [];
    if (Array.isArray(raw.preferences)) {
      preferences = raw.preferences
        .filter((p: any) => typeof p === 'string' && p.trim().length > 0)
        .map((p: string) => p.trim())
        .filter((p: string, idx: number, arr: string[]) => arr.indexOf(p) === idx)
        .slice(0, 10);
    }

    // Validate and sanitize keywords array
    let keywords: string[] = [];
    if (Array.isArray(raw.keywords)) {
      keywords = raw.keywords
        .filter((k: any) => typeof k === 'string' && k.trim().length > 0)
        .map((k: string) => k.trim().toLowerCase())
        .filter((k: string, idx: number, arr: string[]) => arr.indexOf(k) === idx)
        .slice(0, 10);
    }

    return {
      category,
      brand,
      minPrice,
      maxPrice,
      preferences,
      keywords,
    };
  }

  private createEmptyIntent(): CustomerIntent {
    return {
      category: null,
      brand: null,
      minPrice: null,
      maxPrice: null,
      preferences: [],
      keywords: [],
    };
  }
}

export const intentExtractorService = new IntentExtractorService();
