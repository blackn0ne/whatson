import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { funnelStages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { stages } = await request.json();

    await Promise.all(stages.map((stage: any) => 
        db.update(funnelStages)
          .set({ order: stage.order })
          .where(and(eq(funnelStages.id, stage.id), eq(funnelStages.teamId, team.id)))
    ));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}