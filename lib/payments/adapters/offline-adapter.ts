import { db } from '@/lib/db/drizzle';
import { offlinePaymentRequests } from '@/lib/db/schema';
import type { PaymentGatewayAdapter, CheckoutOptions, CheckoutResult } from '../gateway';

export class OfflineAdapter implements PaymentGatewayAdapter {
  readonly type = 'offline' as const;

  async createCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
    
    await db.insert(offlinePaymentRequests).values({
      teamId: options.teamId,
      planId: options.planId,
      amount: options.amount,
      currency: options.currency,
      status: 'pending',
    });

    const params = new URLSearchParams({
      offline: 'true',
      planName: options.planName,
      amount: options.amount.toString(),
      currency: options.currency,
    });

    return {
      url: `${options.cancelUrl}?${params}`,
    };
  }

  async cancelSubscription(): Promise<void> {}

  async verifyWebhook(): Promise<any> {
    return null;
  }
}
