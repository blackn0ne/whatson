import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { paymentGateways, plans, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getGatewayByType } from '@/lib/payments';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(`webhook:${getClientIp(request)}`, RATE_LIMITS.webhook);
    if (limited) return limited;

    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    let event: any;
    try {
      const adapter = await getGatewayByType('razorpay');
      event = await adapter.verifyWebhook(body, signature);
    } catch (err: any) {
      console.error('[Razorpay Webhook] Verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const eventType = event.event;
    const payload = event.payload;

    if (eventType === 'subscription.activated' || eventType === 'subscription.charged') {
      const subscription = payload.subscription?.entity;
      if (!subscription) return NextResponse.json({ received: true });

      const notes = subscription.notes || {};
      const planId = notes.planId ? parseInt(notes.planId) : null;
      const teamId = notes.teamId ? parseInt(notes.teamId) : null;

      if (!planId || !teamId) {
        console.warn('[Razorpay Webhook] Missing planId or teamId in notes');
        return NextResponse.json({ received: true });
      }

      const plan = await db.query.plans.findFirst({
        where: eq(plans.id, planId),
      });

      await db.update(teams).set({
        planId: planId,
        planName: plan?.name || null,
        gatewayType: 'razorpay',
        gatewayCustomerId: subscription.customer_id || null,
        gatewaySubscriptionId: subscription.id,
        subscriptionStatus: 'active',
        updatedAt: new Date(),
      }).where(eq(teams.id, teamId));

    } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.halted') {
      const subscription = payload.subscription?.entity;
      if (!subscription) return NextResponse.json({ received: true });

      const notes = subscription.notes || {};
      const teamId = notes.teamId ? parseInt(notes.teamId) : null;

      if (teamId) {
        
        const freePlan = await db.query.plans.findFirst({
          where: eq(plans.amount, 0),
        });

        await db.update(teams).set({
          planId: freePlan?.id || null,
          planName: freePlan?.name || null,
          gatewaySubscriptionId: null,
          subscriptionStatus: 'active',
          isCanceled: false,
          updatedAt: new Date(),
        }).where(eq(teams.id, teamId));
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Razorpay Webhook]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
