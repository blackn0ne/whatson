import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { executionLogs, chats } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const chatId = parseInt(id);

    
    const chat = await db.query.chats.findFirst({
      where: and(eq(chats.id, chatId), eq(chats.teamId, team.id)),
      columns: { id: true },
    });
    if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

    const messageId = request.nextUrl.searchParams.get('messageId');
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 200);

    const conditions = [eq(executionLogs.chatId, chatId)];
    if (messageId) {
      conditions.push(eq(executionLogs.messageId, messageId));
    }

    const logs = await db.select().from(executionLogs)
      .where(and(...conditions))
      .orderBy(desc(executionLogs.createdAt))
      .limit(limit);

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('[Chat Logs]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
