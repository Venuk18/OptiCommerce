import { OrderStatus, PaymentStatus } from '@prisma/client';

export interface CheckoutInput {
  sessionId: string;
  storeId: string;
  customerId?: string | null;
}

export interface OrderItemResponse {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  lineTotal: number;
}

export interface OrderResponseData {
  orderId: string;
  sessionId?: string;
  storeId?: string;
  customerId?: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
  items: OrderItemResponse[];
}

export interface OrderConfirmationInput {
  sessionId: string;
  storeId: string;
}
