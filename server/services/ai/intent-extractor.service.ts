import { Type } from '@google/genai';
import { CustomerIntent, IntentExtractionResult } from '../../types/intent.types';
import { getGeminiClient } from './gemini.client';

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

const PREFERENCE_PATTERNS = [
  { pattern: /\b(strong\s+bass|extra\s+bass|deep\s+bass|punchy\s+bass|heavy\s+bass|bass\s+boost)\b/i, value: 'strong bass' },
  { pattern: /\b(good\s+battery|long\s+battery|battery\s+life|extended\s+battery|40h|50h|60h)\b/i, value: 'good battery life' },
  { pattern: /\b(noise\s+cancellation|noise\s+cancelling|anc|active\s+noise\s+cancellation)\b/i, value: 'active noise cancellation' },
  { pattern: /\b(wireless|bluetooth|cordless|true\s+wireless)\b/i, value: 'wireless' },
  { pattern: /\b(wired|3\.5mm|aux)\b/i, value: 'wired' },
  { pattern: /\b(waterproof|water\s+resistant|ipx\d|sweatproof)\b/i, value: 'waterproof' },
  { pattern: /\b(fast\s+charg(ing|e)|quick\s+charge|gan)\b/i, value: 'fast charging' },
  { pattern: /\b(lightweight|portable|compact|travel-friendly)\b/i, value: 'lightweight' },
  { pattern: /\b(gaming|low\s+latency|rgb)\b/i, value: 'gaming' },
  { pattern: /\b(studio|audiophile|dj|monitoring|neutral\s+sound)\b/i, value: 'studio monitoring' },
  { pattern: /\b(ergonomic|comfort|comfortable)\b/i, value: 'ergonomic' },
  { pattern: /\b(mechanical|rgb\s+backlit|hot-swappable)\b/i, value: 'mechanical' },
  { pattern: /\b(4k|hdr|144hz|high\s+refresh|oled|ips)\b/i, value: 'high display quality' },
  { pattern: /\b(usb-c|type-c|thunderbolt)\b/i, value: 'type-c connectivity' },
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
   * Main entry point to extract structured shopping intent from customer query.
   * Attempts server-side Gemini parsing first; falls back to deterministic rule-based extractor
   * if Gemini is unavailable, unconfigured, times out, or fails validation.
   */
  async extractIntent(query: string): Promise<IntentExtractionResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return {
        intent: this.createEmptyIntent(),
        source: 'fallback',
      };
    }

    const aiClient = getGeminiClient();

    if (aiClient) {
      try {
        const aiIntent = await this.extractWithGemini(aiClient, trimmedQuery);
        if (aiIntent) {
          const validated = this.validateAndSanitizeIntent(aiIntent);
          if (validated) {
            return {
              intent: validated,
              source: 'ai',
            };
          }
        }
      } catch (err) {
        // Safe silent fallback when AI fails or times out
      }
    }

    // Fallback path
    const fallbackIntent = this.extractWithFallback(trimmedQuery);
    return {
      intent: fallbackIntent,
      source: 'fallback',
    };
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
        model: 'gemini-3.7-flash',
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
        category = cleanCat;
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
