export interface AuthCustomerPayload {
  customerId: string;
  storeId: string;
  role: 'customer';
}

export interface SafeCustomer {
  id: string;
  storeId: string;
  name: string | null;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAuthResult {
  customer: SafeCustomer;
  token: string;
}

declare global {
  namespace Express {
    interface Request {
      customer?: AuthCustomerPayload & {
        profile?: SafeCustomer;
      };
    }
  }
}
