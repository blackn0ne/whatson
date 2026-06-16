import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { funnelStages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const stages = await db.query.funnelStages.findMany({
      where: eq(funnelStages.teamId, team.id),
      orderBy: (funnelStages, { asc }) => [asc(funnelStages.order)],
    });

    if (stages.length === 0) {
        const defaultStages = [
            { teamId: team.id, name: 'New', emoji: '🆕', order: 1 },
            { teamId: team.id, name: 'Negotiation', emoji: '💼', order: 2 },
            { teamId: team.id, name: 'Won', emoji: '🔥', order: 3 },
            { teamId: team.id, name: 'Lost', emoji: '🧊', order: 4 },
        ];

        const newStages = await db.insert(funnelStages)
            .values(defaultStages)
            .returning();
        return NextResponse.json(newStages);
    }

    return NextResponse.json(stages);

  } catch (error: any) {
    console.error('Failed to fetch stages:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
      const team = await getTeamForUser();
      if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
      const { name, emoji } = await request.json();
  
      if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  
      const existing = await db.query.funnelStages.findMany({
          where: eq(funnelStages.teamId, team.id)
      });
  
      const [newStage] = await db.insert(funnelStages)
        .values({
          teamId: team.id,
          name: name,
          emoji: emoji || '📁',
          order: existing.length + 1,
        })
        .returning();
  
      return NextResponse.json(newStage, { status: 201 });
  
    } catch (error: any) {
      return NextResponse.json({ error: 'Failed to create the stage.' }, { status: 500 });
    }
  }