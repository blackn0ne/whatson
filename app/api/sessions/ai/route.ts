import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { aiSessions, chats, contacts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sessions = await db.query.aiSessions.findMany({
      where: and(
        eq(aiSessions.teamId, team.id),
        eq(aiSessions.status, 'active'),
      ),
      with: {
        chat: {
          columns: { id: true, remoteJid: true, name: true, pushName: true, profilePicUrl: true },
        },
      },
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
    });

    
    const result = await Promise.all(
      sessions.map(async (s) => {
        const contact = await db.query.contacts.findFirst({
          where: eq(contacts.chatId, s.chatId),
          columns: { name: true },
        });
        return {
          id: s.id,
          chatId: s.chatId,
          status: s.status,
          contactName: contact?.name || s.chat?.name || s.chat?.pushName || null,
          contactPhone: s.chat?.remoteJid?.split('@')[0] || null,
          profilePicUrl: s.chat?.profilePicUrl || null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      }),
    );

    return NextResponse.json({ sessions: result });
  } catch (error: any) {
    console.error('[Sessions AI]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
