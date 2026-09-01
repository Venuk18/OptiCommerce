import { PaymentStatus, OrderStatus } from '@prisma/client';

export interface CreatePaymentOrderInput {
  orderId: string;
  sessionId: string;
  storeId: string;
}

export interface CreatePaymentOrderResponseData {
  razorpayOrderId: string;
  amount: number; // in paise (e.g. 500000 for ₹5,000.00)
  currency: string; // "INR"
  keyId: string; // public razorpay key id
}

export interface VerifyPaymentInput {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  sessionId: string;
  storeId: string;
}

export interface VerifyPaymentResponseData {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  razorpayPaymentId: string;
}

export interface PaymentWebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        method?: string;
        [key: string]: any;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        receipt?: string;
        [key: string]: any;
      };
    };
    [key: string]: any;
  };
  created_at: number;
}
