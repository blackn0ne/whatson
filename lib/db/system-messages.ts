import { db } from '@/lib/db/drizzle';
import { messages, chats } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher-server';

export async function createSystemMessage(
  teamId: number,
  chatId: number,
  text: string
) {
  const messageId = `system_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date();

  const [newMessage] = await db.insert(messages).values({
    id: messageId,
    chatId,
    fromMe: true,
    messageType: 'system', 
    text,
    timestamp,
    status: 'read',
    isInternal: true,
  }).returning();

  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    columns: { remoteJid: true, instanceId: true }
  });

  if (chat) {
      await db.update(chats).set({
        lastMessageTimestamp: timestamp,
      }).where(eq(chats.id, chatId));

      const channelName = `team-${teamId}`;
      
      await pusherServer.trigger(channelName, 'new-message', {
        ...newMessage,
        timestamp: timestamp.toISOString(),
        remoteJid: chat.remoteJid,
      });

      await pusherServer.trigger(channelName, 'chat-list-update', {
        id: chatId,
        lastMessageTimestamp: timestamp.toISOString(),
        remoteJid: chat.remoteJid,
        unreadCount: 0
      });
  }

  return newMessage;
}