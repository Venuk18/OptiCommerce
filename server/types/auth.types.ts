import { SafeMerchant } from '../services/auth.service';

export interface AuthMerchantPayload {
  id: string;
  name: string;
  email: string;
  storeId?: string;
  storeSlug?: string;
  store?: SafeMerchant['store'];
}

declare global {
  namespace Express {
    interface Request {
      merchant?: AuthMerchantPayload;
    }
  }
}
