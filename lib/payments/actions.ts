'use server';

import { redirect } from 'next/navigation';
import { withTeam } from '@/lib/auth/middleware';
import { db } from '@/lib/db/drizzle';
import { teams, plans, paymentGateways } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { getGatewayById } from '@/lib/payments';
import { StripeAdapter } from '@/lib/payments/adapters/stripe-adapter';

export const checkoutAction = withTeam(async (formData, team) => {
  const planId = parseInt(formData.get('planId') as string);
  const user = await getUser();
  if (!user) redirect('/sign-up');

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
  });

  if (!plan || plan.amount <= 0) {
    throw new Error('Invalid plan');
  }

  
  if (plan.gatewayId) {
    const adapter = await getGatewayById(plan.gatewayId);

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const successUrl = adapter.type === 'stripe'
      ? `${baseUrl}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}/dashboard`;

    const result = await adapter.createCheckout({
      planId: plan.id,
      planName: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval as 'month' | 'year',
      trialDays: plan.trialDays || 0,
      teamId: team.id,
      userId: user.id,
      successUrl,
      cancelUrl: `${baseUrl}/pricing`,
      gatewayProductId: plan.gatewayProductId || undefined,
      gatewayPriceId: plan.gatewayPriceId || undefined,
      existingCustomerId: adapter.type === 'stripe' ? (team.stripeCustomerId || undefined) : undefined,
    });

    
    if (result.metadata?.razorpayPlanId && !plan.gatewayPriceId) {
      await db.update(plans).set({
        gatewayPriceId: result.metadata.razorpayPlanId,
      }).where(eq(plans.id, plan.id));
    }

    if (result.url) {
      redirect(result.url);
    }
  } else {
    
    const { createCheckoutSession } = await import('./stripe');
    const priceId = plan.stripePriceId;
    if (!priceId) throw new Error('No price configured for this plan');
    await createCheckoutSession({ team, priceId });
  }
});

export const customerPortalAction = withTeam(async (_, team) => {
  if (!team.stripeCustomerId) {
    redirect('/pricing');
  }

  
  if (team.gatewayType === 'stripe') {
    const gw = await db.query.paymentGateways.findFirst({
      where: eq(paymentGateways.gateway, 'stripe'),
    });
    if (gw) {
      const adapter = new StripeAdapter(gw.secretKey);
      const session = await adapter.createPortalSession!(team.stripeCustomerId, `${process.env.BASE_URL || 'http://localhost:3000'}/dashboard`);
      if (session) redirect(session.url);
    }
  }

  
  const { createCustomerPortalSession } = await import('./stripe');
  const portalSession = await createCustomerPortalSession(team);
  redirect(portalSession.url);
});

export const joinFreePlanAction = withTeam(async (formData, team) => {
  const planId = parseInt(formData.get('planId') as string);
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId)
  });

  if (!plan || plan.amount > 0) {
    throw new Error("This plan is not free.");
  }

  
  if (team.stripeSubscriptionId || team.gatewaySubscriptionId) {
    try {
      const subId = team.gatewaySubscriptionId || team.stripeSubscriptionId;
      const gwType = team.gatewayType || 'stripe';

      if (subId) {
        const gw = await db.query.paymentGateways.findFirst({
          where: eq(paymentGateways.gateway, gwType),
        });
        if (gw) {
          const adapter = gwType === 'stripe'
            ? new StripeAdapter(gw.secretKey)
            : (await import('./adapters/razorpay-adapter')).RazorpayAdapter && new (await import('./adapters/razorpay-adapter')).RazorpayAdapter(gw.publicKey, gw.secretKey);
          if (adapter) await adapter.cancelSubscription(subId);
        }
      }
    } catch (error) {
      console.error("Error canceling subscription:", error);
    }
  }

  await db.update(teams).set({
    planId: plan.id,
    subscriptionStatus: 'active',
    stripeSubscriptionId: null,
    stripeProductId: null,
    gatewaySubscriptionId: null,
    gatewayType: null,
    planName: plan.name,
    updatedAt: new Date()
  }).where(eq(teams.id, team.id));

  redirect('/dashboard');
});
