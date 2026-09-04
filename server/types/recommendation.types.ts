import { CustomerIntent, IntentMode } from './intent.types';
import { CandidateProduct } from './search.types';
import { RankedProduct } from './ranking.types';
import { ProductComparisonResult } from './comparison.types';
import { CartCrossSellResult, BundleOpportunity } from './bundle.types';
import { CommercialOffer } from './commercial.types';

export interface DiscussedProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  position: number;
}

export type ConversationStage =
  | 'DISCOVERY'
  | 'CLARIFYING'
  | 'EVALUATING'
  | 'COMPARING'
  | 'READY_TO_BUY';

export interface ConversationState {
  goal: string | null;
  category: string | null;
  budget: {
    min: number | null;
    max: number | null;
  };
  preferences: string[];
  exclusions: string[];
  useCase: string | null;
  discussedProducts: DiscussedProduct[];
  rejectedProducts: string[];
  selectedProductId: string | null;
  stage: ConversationStage;
  pendingClarification?: {
    question: string;
    options: string[];
  } | null;
}

export interface ConversationMessageHistory {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationContextInput {
  history?: ConversationMessageHistory[];
  state?: ConversationState;
}

export interface RecommendProductsInput {
  storeId: string;
  query: string;
  conversationContext?: ConversationContextInput;
  cartProductIds?: string[];
  focusedProductId?: string;
  sessionId?: string;
}

export interface RecommendProductsResult {
  query: string;
  intent: CustomerIntent;
  recommendations: RankedProduct[];
  products?: CandidateProduct[];
  message?: string;
  salesOverview?: string;
  conversationState?: ConversationState;
  mode?: IntentMode;
  resolvedProducts?: DiscussedProduct[];
  comparison?: ProductComparisonResult;
  crossSell?: CartCrossSellResult;
  bundleOpportunity?: BundleOpportunity | null;
  commercialOffer?: CommercialOffer;
}
