import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle'; 
import { getTeamForUser } from '@/lib/db/queries'; 
import { chats, messages } from '@/lib/db/schema'; 
import { eq, and, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const jid = searchParams.get('jid');
    const instanceId = searchParams.get('instanceId');
    const chatId = searchParams.get('chatId');

    let chat;

    if (chatId) {
        chat = await db.query.chats.findFirst({
            where: and(
                eq(chats.teamId, team.id),
                eq(chats.id, parseInt(chatId))
            ),
            columns: { id: true }
        });
    } else {
        if (!jid) {
            return NextResponse.json({ error: 'jid (remoteJid) is required' }, { status: 400 });
        }

        const conditions = [
            eq(chats.teamId, team.id),
            eq(chats.remoteJid, jid)
        ];

        if (instanceId) {
            conditions.push(eq(chats.instanceId, parseInt(instanceId)));
        }

        chat = await db.query.chats.findFirst({
            where: and(...conditions),
            columns: { id: true } 
        });
    }

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found or unauthorized' }, { status: 404 });
    }

    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.chatId, chat.id),
      orderBy: [asc(messages.timestamp)],
      with: {
        reactions: {
          columns: {
            id: true,
            emoji: true,
            fromMe: true,
            remoteJid: true,
            participantName: true,
          },
        },
      },
    });

    return NextResponse.json(chatMessages);

  } catch (error: any) {
    console.error('Error fetching messages:', error.message);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}