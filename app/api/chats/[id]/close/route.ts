import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { automationSessions, chats } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createSystemMessage } from '@/lib/db/system-messages';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    const user = await getUser();
    if (!team || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const chatId = parseInt(id);

    
    await db.update(automationSessions)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(and(eq(automationSessions.chatId, chatId), eq(automationSessions.status, 'active')));

    
    
    
    await createSystemMessage(team.id, chatId, `@@syslog_chat_closed|name=${user.name || user.email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error closing chat:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}