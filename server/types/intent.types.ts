export interface CustomerIntent {
  category: string | null;
  brand: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  preferences: string[];
  keywords: string[];
}

export interface IntentExtractionResult {
  intent: CustomerIntent;
  source: 'ai' | 'fallback';
}
