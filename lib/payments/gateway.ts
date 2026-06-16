

export interface CheckoutOptions {
  planId: number;
  planName: string;
  amount: number; 
  currency: string;
  interval: 'month' | 'year';
  trialDays?: number;
  teamId: number;
  userId: number;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  gatewayProductId?: string;
  gatewayPriceId?: string;
  existingCustomerId?: string;
}

export interface CheckoutResult {
  
  url?: string;
  
  orderId?: string;
  
  metadata?: Record<string, any>;
}

export interface SubscriptionInfo {
  gatewaySubscriptionId: string;
  gatewayCustomerId: string;
  status: string;
  productId?: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Date | null;
}

export interface PaymentGatewayAdapter {
  readonly type: 'stripe' | 'razorpay' | 'offline';

  
  createCheckout(options: CheckoutOptions): Promise<CheckoutResult>;

  
  cancelSubscription(subscriptionId: string): Promise<void>;

  
  createPortalSession?(customerId: string, returnUrl: string): Promise<{ url: string } | null>;

  
  verifyWebhook(body: string, signature: string): Promise<any>;
}
