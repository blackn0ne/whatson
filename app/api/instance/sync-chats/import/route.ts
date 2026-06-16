import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { evolutionInstances, chats, contacts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { instanceId, selectedChats, saveContacts = false } = await request.json();
    if (!instanceId || !Array.isArray(selectedChats) || selectedChats.length === 0) {
      return NextResponse.json({ error: 'instanceId and selectedChats[] are required' }, { status: 400 });
    }

    const instance = await db.query.evolutionInstances.findFirst({
      where: and(
        eq(evolutionInstances.id, instanceId),
        eq(evolutionInstances.teamId, team.id)
      ),
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    let imported = 0;
    let skipped = 0;
    let contactsSaved = 0;

    for (const chat of selectedChats) {
      try {
        const lastMessageTs = chat.lastMessageTimestamp
          ? new Date(chat.lastMessageTimestamp)
          : null;

        const [insertedChat] = await db
          .insert(chats)
          .values({
            teamId: team.id,
            instanceId: instance.id,
            remoteJid: chat.remoteJid,
            name: chat.name || chat.remoteJid.split('@')[0],
            profilePicUrl: chat.profilePicUrl || null,
            lastMessageText: chat.lastMessageText || null,
            lastMessageTimestamp: lastMessageTs,
            lastMessageFromMe: chat.lastMessageFromMe ?? null,
            unreadCount: 0,
            lastMessageStatus: null,
          })
          .onConflictDoNothing()
          .returning({ id: chats.id });

        imported++;

        if (saveContacts && insertedChat && !chat.isGroup) {
          try {
            await db
              .insert(contacts)
              .values({
                teamId: team.id,
                chatId: insertedChat.id,
                name: chat.name || chat.remoteJid.split('@')[0],
              })
              .onConflictDoNothing();
            contactsSaved++;
          } catch {
          }
        }
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({ imported, skipped, contactsSaved, total: selectedChats.length });
  } catch (error: any) {
    console.error('Error in sync-chats/import:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
