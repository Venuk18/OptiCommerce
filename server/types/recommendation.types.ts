import { CustomerIntent } from './intent.types';
import { CandidateProduct } from './search.types';
import { RankedProduct } from './ranking.types';

export interface RecommendProductsInput {
  storeId: string;
  query: string;
}

export interface RecommendProductsResult {
  query: string;
  intent: CustomerIntent;
  recommendations: RankedProduct[];
  products?: CandidateProduct[];
  message?: string;
}
