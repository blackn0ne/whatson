import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/drizzle';
import { teams, plans } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  getTeamByStripeCustomerId,
  getUser,
  getFreePlan
} from '@/lib/db/queries';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil'
});

export async function createCheckoutSession({
  team,
  priceId
}: {
  team: typeof teams.$inferSelect | null;
  priceId: string;
}) {
  const user = await getUser();

  if (!team || !user) {
    redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
  }

  const plan = await db.query.plans.findFirst({
    where: eq(plans.stripePriceId, priceId)
  });

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    metadata: {
        planId: plan?.id.toString() || ''
    }
  };

  if (plan && plan.trialDays > 0) {
    subscriptionData.trial_period_days = plan.trialDays;
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/pricing`,
    customer: team.stripeCustomerId || undefined,
    client_reference_id: user.id.toString(),
    allow_promotion_codes: true,
    subscription_data: subscriptionData,
  });

  redirect(session.url!);
}

export async function createCustomerPortalSession(team: typeof teams.$inferSelect) {
  if (!team.stripeCustomerId || !team.stripeProductId) {
    redirect('/pricing');
  }

  let configuration: Stripe.BillingPortal.Configuration;
  const configurations = await stripe.billingPortal.configurations.list();

  if (configurations.data.length > 0) {
    configuration = configurations.data[0];
  } else {
    const product = await stripe.products.retrieve(team.stripeProductId);
    if (!product.active) {
      throw new Error("Team's product is not active in Stripe");
    }

    const prices = await stripe.prices.list({
      product: product.id,
      active: true
    });
    if (prices.data.length === 0) {
      throw new Error("No active prices found for the team's product");
    }

    configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your subscription'
      },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity', 'promotion_code'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: product.id,
              prices: prices.data.map((price) => price.id)
            }
          ]
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other'
            ]
          }
        },
        payment_method_update: {
          enabled: true
        }
      }
    });
  }

  return stripe.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/dashboard`,
    configuration: configuration.id
  });
}

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  const planStripeProduct = subscription.items.data[0]?.price.product as string;
  let localPlanId = null;
  let planName = null;

  if (status === 'active' || status === 'trialing') {
    if (planStripeProduct) {
      const localPlan = await db.query.plans.findFirst({
        where: eq(plans.stripeProductId, planStripeProduct)
      });
      if (localPlan) {
        localPlanId = localPlan.id;
        planName = localPlan.name;
      }
    }
  } else if (status === 'canceled' || status === 'unpaid') {
    const freePlan = await getFreePlan();
    if (freePlan) {
      localPlanId = freePlan.id;
      planName = freePlan.name;
    }
  }

  const updateData: any = {
    stripeSubscriptionId: status === 'canceled' ? null : subscriptionId,
    subscriptionStatus: status,
    isCanceled: subscription.cancel_at_period_end,
    trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    updatedAt: new Date()
  };

  if (localPlanId) {
    updateData.planId = localPlanId;
    updateData.planName = planName;
    if (status === 'canceled' || status === 'unpaid') {
      updateData.subscriptionStatus = 'active';
      updateData.isCanceled = false;
      updateData.trialEndsAt = null;
    }
  }

  if (planStripeProduct && status !== 'canceled' && status !== 'unpaid') {
      updateData.stripeProductId = planStripeProduct;
  }

  await db.update(teams)
    .set(updateData)
    .where(eq(teams.id, team.id));
}

export async function getStripePrices() {
  const prices = await stripe.prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring'
  });

  return prices.data.map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval,
    trialPeriodDays: price.recurring?.trial_period_days
  }));
}

export async function getStripeProducts() {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price']
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    defaultPriceId:
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id
  }));
}