import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../../config/env';

let razorpayInstance: Razorpay | null = null;

export class RazorpayClient {
  /**
   * Check if real Razorpay credentials are configured
   */
  static hasCredentials(): boolean {
    return Boolean(config.razorpayKeyId?.trim() && config.razorpayKeySecret?.trim());
  }

  /**
   * Lazy initialization of the Razorpay SDK instance
   */
  static getInstance(): Razorpay | null {
    if (!this.hasCredentials()) {
      return null;
    }
    if (!razorpayInstance) {
      razorpayInstance = new Razorpay({
        key_id: config.razorpayKeyId.trim(),
        key_secret: config.razorpayKeySecret.trim(),
      });
    }
    return razorpayInstance;
  }

  /**
   * Get public Key ID for client initialization.
   * NEVER returns secret.
   */
  static getPublicKeyId(): string {
    return config.razorpayKeyId?.trim() || 'rzp_test_mock_key_id';
  }

  /**
   * Create an order on Razorpay or sandbox fallback
   * @param options.amountInPaise Amount strictly in paise (e.g. 500000 = ₹5,000.00)
   * @param options.receipt Internal unique order receipt reference
   */
  static async createOrder(options: {
    amountInPaise: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number; currency: string; status: string }> {
    const { amountInPaise, receipt, notes } = options;

    const rzp = this.getInstance();
    if (rzp) {
      const order = await rzp.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: notes || {},
      });
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
      };
    }

    // Deterministic Sandbox Mock Fallback when in development / test without live credentials
    const mockOrderId = `order_${crypto.randomBytes(10).toString('hex')}`;
    return {
      id: mockOrderId,
      amount: amountInPaise,
      currency: 'INR',
      status: 'created',
    };
  }

  /**
   * Verify standard Razorpay payment signature
   * signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
   */
  static verifyPaymentSignature(options: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = options;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return false;
    }

    const secret = config.razorpayKeySecret?.trim() || 'mock_secret_for_test_mode';
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Safe timing-safe equal comparison
    try {
      const sigBuf = Buffer.from(razorpaySignature, 'utf8');
      const expBuf = Buffer.from(expectedSignature, 'utf8');
      if (sigBuf.length !== expBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  /**
   * Verify Razorpay Webhook signature
   */
  static verifyWebhookSignature(options: {
    rawBody: string;
    signature: string;
  }): boolean {
    const { rawBody, signature } = options;

    if (!rawBody || !signature) {
      return false;
    }

    const secret =
      config.razorpayWebhookSecret?.trim() ||
      config.razorpayKeySecret?.trim() ||
      'mock_secret_for_test_mode';

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expectedSignature, 'utf8');
      if (sigBuf.length !== expBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  static getKeySecret(): string {
    return config.razorpayKeySecret?.trim() || 'mock_secret_for_test_mode';
  }

  static getWebhookSecret(): string {
    return (
      config.razorpayWebhookSecret?.trim() ||
      config.razorpayKeySecret?.trim() ||
      'mock_secret_for_test_mode'
    );
  }
}

export const razorpayClient = RazorpayClient;
