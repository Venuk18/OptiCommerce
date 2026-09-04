import { CustomerIntent } from './intent.types';

export interface CandidateProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  brand: string | null;
  price: number;
  stock: number;
  images: string[];
  features: string[];
  specifications: Record<string, any> | null;
  tags: string[];
  relevanceScore: number;
  isBudgetRelaxed?: boolean;
  originalBudgetMax?: number | null;
}

export interface SearchCandidatesInput {
  storeId: string;
  intent: CustomerIntent;
}

export interface SearchCandidatesResult {
  products: CandidateProduct[];
  count: number;
  isBudgetRelaxed?: boolean;
  originalBudgetMax?: number | null;
}
