import Stripe from 'stripe';
import type { PaymentGatewayAdapter, CheckoutOptions, CheckoutResult } from '../gateway';

export class StripeAdapter implements PaymentGatewayAdapter {
  readonly type = 'stripe' as const;
  private client: Stripe;
  private webhookSecret?: string;

  constructor(secretKey: string, webhookSecret?: string) {
    this.client = new Stripe(secretKey, { apiVersion: '2025-08-27.basil' });
    this.webhookSecret = webhookSecret;
  }

  get stripeClient() {
    return this.client;
  }

  async createCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: { planId: options.planId.toString(), teamId: options.teamId.toString() },
    };

    if (options.trialDays && options.trialDays > 0) {
      subscriptionData.trial_period_days = options.trialDays;
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (options.gatewayPriceId) {
      lineItems.push({ price: options.gatewayPriceId, quantity: 1 });
    } else {
      lineItems.push({
        price_data: {
          currency: options.currency,
          product_data: { name: options.planName },
          unit_amount: options.amount,
          recurring: { interval: options.interval },
        },
        quantity: 1,
      });
    }

    const session = await this.client.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      customer: options.existingCustomerId || undefined,
      client_reference_id: options.userId.toString(),
      allow_promotion_codes: true,
      subscription_data: subscriptionData,
    });

    return { url: session.url! };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.client.subscriptions.cancel(subscriptionId);
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async verifyWebhook(body: string, signature: string): Promise<Stripe.Event> {
    if (!this.webhookSecret) throw new Error('Webhook secret not configured');
    return this.client.webhooks.constructEvent(body, signature, this.webhookSecret);
  }
}
