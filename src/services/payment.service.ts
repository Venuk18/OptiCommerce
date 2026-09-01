import { apiFetch } from './api.client';
import { getAnonymousSessionId } from './event.service';
import { CreatePaymentOrderResponse, VerifyPaymentResponse } from '../types';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export const paymentService = {
  /**
   * POST /api/payments/create-order
   * Initiates payment order from server-authoritative PostgreSQL order total
   */
  async createPaymentOrder(orderId: string, storeId: string): Promise<CreatePaymentOrderResponse> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<CreatePaymentOrderResponse>('/api/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({
        orderId,
        sessionId,
        storeId,
      }),
    });
    return response;
  },

  /**
   * POST /api/payments/verify
   * Server-authoritative HMAC signature verification
   */
  async verifyPayment(options: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    storeId: string;
  }): Promise<VerifyPaymentResponse> {
    const sessionId = getAnonymousSessionId();
    const response = await apiFetch<VerifyPaymentResponse>('/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        orderId: options.orderId,
        razorpayOrderId: options.razorpayOrderId,
        razorpayPaymentId: options.razorpayPaymentId,
        razorpaySignature: options.razorpaySignature,
        sessionId,
        storeId: options.storeId,
      }),
    });
    return response;
  },

  /**
   * Dynamically loads Razorpay checkout script if not present
   */
  async loadRazorpayScript(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (window.Razorpay) return true;

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn('[Razorpay] Failed to load external checkout script; fallback active');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  },
};
