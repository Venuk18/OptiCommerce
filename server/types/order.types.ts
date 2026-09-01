import { OrderStatus, PaymentStatus } from '@prisma/client';

export interface CheckoutInput {
  sessionId: string;
  storeId: string;
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
