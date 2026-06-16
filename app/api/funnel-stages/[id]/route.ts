import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { funnelStages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { name, emoji } = await request.json();
    const stageId = parseInt(id);

    await db.update(funnelStages)
      .set({ name, emoji })
      .where(and(eq(funnelStages.id, stageId), eq(funnelStages.teamId, team.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const team = await getTeamForUser();
      if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
      const { id } = await params;
      const stageId = parseInt(id);
  
      await db.delete(funnelStages)
        .where(and(eq(funnelStages.id, stageId), eq(funnelStages.teamId, team.id)));
  
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }