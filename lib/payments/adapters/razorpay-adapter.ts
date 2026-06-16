import Razorpay from 'razorpay';
import crypto from 'crypto';
import type { PaymentGatewayAdapter, CheckoutOptions, CheckoutResult } from '../gateway';

export class RazorpayAdapter implements PaymentGatewayAdapter {
  readonly type = 'razorpay' as const;
  private client: InstanceType<typeof Razorpay>;
  private keyId: string;
  private webhookSecret?: string;

  constructor(keyId: string, keySecret: string, webhookSecret?: string) {
    this.keyId = keyId;
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    this.webhookSecret = webhookSecret;
  }

  async createCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
    
    let razorpayPlanId = options.gatewayPriceId;

    if (!razorpayPlanId) {
      
      const plan = await this.client.plans.create({
        period: options.interval === 'year' ? 'yearly' : 'monthly',
        interval: 1,
        item: {
          name: options.planName,
          amount: options.amount,
          currency: options.currency.toUpperCase(),
        },
      });
      razorpayPlanId = plan.id;
    }

    
    const subscription = await this.client.subscriptions.create({
      plan_id: razorpayPlanId,
      total_count: options.interval === 'year' ? 10 : 120,
      customer_notify: 1,
      notes: {
        planId: options.planId.toString(),
        teamId: options.teamId.toString(),
        userId: options.userId.toString(),
      },
    });

    return {
      url: (subscription as any).short_url,
      orderId: subscription.id,
      metadata: {
        subscriptionId: subscription.id,
        razorpayPlanId,
        keyId: this.keyId,
      },
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.client.subscriptions.cancel(subscriptionId, { cancel_at_cycle_end: 1 } as any);
  }

  async verifyWebhook(body: string, signature: string): Promise<any> {
    
    if (!this.webhookSecret) {
      return JSON.parse(body);
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new Error('Invalid webhook signature');
    }

    return JSON.parse(body);
  }
}
