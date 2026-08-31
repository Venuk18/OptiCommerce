import { CustomerIntent } from './intent.types';
import { CandidateProduct } from './search.types';

export interface RankedProduct {
  productId: string;
  rank: number;
  matchScore: number;
  reason: string;
}

export interface RankProductsInput {
  intent: CustomerIntent;
  products: CandidateProduct[];
}

export interface RankProductsResult {
  rankedProducts: RankedProduct[];
}
