import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { automationSessions } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sessions = await db.query.automationSessions.findMany({
      where: and(
        eq(automationSessions.teamId, team.id),
        inArray(automationSessions.status, ['active', 'paused']),
      ),
      with: {
        automation: { columns: { id: true, name: true } },
        chat: { columns: { id: true, remoteJid: true, name: true, pushName: true, profilePicUrl: true } },
        contact: { columns: { name: true } },
      },
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
    });

    const result = sessions.map((s) => ({
      id: s.id,
      chatId: s.chatId,
      status: s.status,
      automationName: s.automation?.name || null,
      contactName: s.contact?.name || s.chat?.name || s.chat?.pushName || null,
      contactPhone: s.chat?.remoteJid?.split('@')[0] || null,
      profilePicUrl: s.chat?.profilePicUrl || null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return NextResponse.json({ sessions: result });
  } catch (error: any) {
    console.error('[Sessions Automation]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
