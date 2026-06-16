import Stripe from 'stripe';
import { handleSubscriptionChange } from '@/lib/payments/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { paymentGateways } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { StripeAdapter } from '@/lib/payments/adapters/stripe-adapter';

async function getStripeWebhookConfig() {
  
  const gw = await db.query.paymentGateways.findFirst({
    where: and(eq(paymentGateways.gateway, 'stripe'), eq(paymentGateways.isActive, true)),
  });
  if (gw) {
    return { secretKey: gw.secretKey, webhookSecret: gw.webhookSecret || '' };
  }
  return { secretKey: process.env.STRIPE_SECRET_KEY!, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET! };
}

async function handlePhoneNumberPurchase(session: Stripe.Checkout.Session) {
  const phoneNumber = session.metadata?.phoneNumber;
  const teamId = session.metadata?.teamId;
  const subscriptionId = session.subscription as string | null;

  if (!phoneNumber || !teamId) {
    console.error('[Stripe Webhook] Missing metadata for phone_number_purchase');
    return;
  }

  try {
    
    const { provisionPhoneNumber } = await import('@/lib/plugins/voice-call/service');
    await provisionPhoneNumber(parseInt(teamId, 10), phoneNumber, subscriptionId);
  } catch (err: any) {
    console.error('[Stripe Webhook] Failed to provision phone number:', err.message);
  }
}

async function handleVoiceCreditsPurchase(session: Stripe.Checkout.Session) {
  const teamId = session.metadata?.teamId;
  const creditAmount = session.metadata?.creditAmount;
  const paymentIntentId = session.payment_intent as string | null;

  if (!teamId || !creditAmount) {
    console.error('[Stripe Webhook] Missing metadata for voice_credits');
    return;
  }

  try {
    const { addCredits } = await import('@/lib/plugins/voice-call/service');
    await addCredits(
      parseInt(teamId, 10),
      parseInt(creditAmount, 10),
      paymentIntentId || undefined,
      'Credit pack purchase',
    );
  } catch (err: any) {
    console.error('[Stripe Webhook] Failed to add voice credits:', err.message);
  }
}

export async function POST(request: NextRequest) {
  const { checkRateLimit, getClientIp, RATE_LIMITS } = await import('@/lib/rate-limit');
  const limited = checkRateLimit(`webhook:${getClientIp(request)}`, RATE_LIMITS.webhook);
  if (limited) return limited;

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  const config = await getStripeWebhookConfig();
  const adapter = new StripeAdapter(config.secretKey, config.webhookSecret);

  let event: Stripe.Event;

  try {
    event = await adapter.verifyWebhook(payload, signature);
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription);
      break;

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const type = session.metadata?.type;

      if (type === 'phone_number_purchase') {
        await handlePhoneNumberPurchase(session);
      } else if (type === 'voice_credits') {
        await handleVoiceCreditsPurchase(session);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
