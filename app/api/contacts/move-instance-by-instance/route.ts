import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { chats } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PUT(req: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sourceInstanceId, targetInstanceId } = await req.json();

    if (!sourceInstanceId || !targetInstanceId) {
      return NextResponse.json({ error: 'sourceInstanceId and targetInstanceId are required' }, { status: 400 });
    }

    const result = await db.update(chats)
      .set({ instanceId: targetInstanceId })
      .where(and(
        eq(chats.teamId, team.id),
        eq(chats.instanceId, sourceInstanceId)
      ));

    return NextResponse.json({
      message: 'Contacts moved successfully'
    });

  } catch (error: any) {
    console.error('Error moving contacts by instance:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
