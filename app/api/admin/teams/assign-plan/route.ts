import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { teams, plans } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, planId } = await request.json();

    if (!teamId || !planId) {
      return NextResponse.json({ error: 'teamId and planId required' }, { status: 400 });
    }

    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, planId),
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    await db.update(teams).set({
      planId: plan.id,
      planName: plan.name,
      subscriptionStatus: 'active',
      updatedAt: new Date(),
    }).where(eq(teams.id, teamId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin Assign Plan]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
