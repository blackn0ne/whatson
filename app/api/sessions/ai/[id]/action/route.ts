import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { aiSessions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const sessionId = parseInt(id);
    const { action } = await request.json();

    if (!['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const session = await db.query.aiSessions.findFirst({
      where: and(eq(aiSessions.id, sessionId), eq(aiSessions.teamId, team.id)),
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (action === 'cancel') {
      await db.delete(aiSessions).where(eq(aiSessions.id, sessionId));
    } else {
      const newStatus = action === 'pause' ? 'paused' : 'active';
      await db.update(aiSessions)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(aiSessions.id, sessionId));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Sessions AI Action]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
