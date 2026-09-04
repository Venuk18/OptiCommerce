export type IntentMode =
  | 'NEW_REQUEST'
  | 'FOLLOW_UP_REFINEMENT'
  | 'PRODUCT_QUESTION'
  | 'PRODUCT_REFERENCE'
  | 'COMPARISON_REQUEST'
  | 'DISSATISFACTION'
  | 'CLARIFICATION_ANSWER'
  | 'CROSS_SELL_REQUEST'
  | 'BUNDLE_REQUEST';

export type DissatisfactionReason =
  | 'PRICE'
  | 'PERFORMANCE'
  | 'BRAND'
  | 'FEATURE'
  | 'SIZE'
  | 'DESIGN'
  | 'RATING'
  | 'USE_CASE'
  | 'OTHER'
  | 'UNKNOWN';

export interface DissatisfactionDetectionResult {
  isDissatisfied: boolean;
  reason: DissatisfactionReason | null;
  confidence: number;
  extractedConstraint?: {
    maxPrice?: number;
    minPrice?: number;
    excludedBrand?: string;
    preferredBrand?: string;
    addedPreferences?: string[];
    useCase?: string;
  };
  suggestedClarificationQuestion?: string;
  clarificationOptions?: string[];
}

export interface ReferenceResolutionResult {
  resolved: boolean;
  mode: 'single' | 'multiple' | 'invalid' | 'none';
  referencedPositions: number[];
  referencedProductIds: string[];
  unresolvedMessage?: string;
  comparisonAttribute?: string;
}

export interface CustomerIntent {
  category: string | null;
  brand: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  preferences: string[];
  keywords: string[];
  mode?: IntentMode;
  useCase?: string | null;
  targetProductPositions?: number[];
  comparisonAttributes?: string[];
  exclusions?: string[];
  rejectedProductIds?: string[];
}

export interface IntentExtractionResult {
  intent: CustomerIntent;
  source: 'ai' | 'fallback' | 'context_merged';
  mode: IntentMode;
  referenceResolution?: ReferenceResolutionResult;
  dissatisfactionResult?: DissatisfactionDetectionResult;
}

