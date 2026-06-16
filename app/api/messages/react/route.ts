import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { messages, chats, evolutionInstances, messageReactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher-server';
import { getWhatsAppProvider } from '@/lib/whatsapp/provider-factory';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';

export async function POST(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { messageId, emoji, remoteJid, instanceId } = await request.json();

    if (!messageId || !remoteJid) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const message = await db.query.messages.findFirst({
      where: eq(messages.id, messageId),
      columns: { id: true, chatId: true, fromMe: true },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const chat = await db.query.chats.findFirst({
      where: and(eq(chats.id, message.chatId), eq(chats.teamId, team.id)),
      columns: { id: true, instanceId: true },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const resolvedInstanceId = instanceId || chat.instanceId;
    if (!resolvedInstanceId) {
      return NextResponse.json({ error: 'No instance found' }, { status: 400 });
    }

    const instance = await db.query.evolutionInstances.findFirst({
      where: eq(evolutionInstances.id, resolvedInstanceId),
      columns: { instanceName: true, accessToken: true, integration: true, metaToken: true, metaPhoneNumberId: true, id: true },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not configured' }, { status: 400 });
    }

    
    if (instance.integration === 'META-CLOUD') {
      const provider = await getWhatsAppProvider({
        id: instance.id, instanceName: instance.instanceName,
        accessToken: instance.accessToken || '', integration: instance.integration,
        metaToken: instance.metaToken, metaPhoneNumberId: instance.metaPhoneNumberId,
      });

      const result = await provider.sendReaction(remoteJid, {
        messageId, emoji: emoji || '', fromMe: message.fromMe,
      });

      if (!result.success) {
        return NextResponse.json({ error: 'Failed to send reaction' }, { status: 500 });
      }
    } else {
      
      const payload = {
        key: { remoteJid, fromMe: message.fromMe, id: messageId },
        reaction: emoji || '',
      };

      const response = await fetch(`${EVOLUTION_API_URL}/message/sendReaction/${instance.instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': instance.accessToken! },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Evolution API reaction error:', errorData);
        return NextResponse.json({ error: 'Failed to send reaction' }, { status: 500 });
      }
    }

    
    if (emoji) {
      await db
        .insert(messageReactions)
        .values({
          messageId,
          chatId: message.chatId,
          emoji,
          fromMe: true,
          remoteJid: null,
          timestamp: new Date(),
        })
        .onConflictDoUpdate({
          target: [messageReactions.messageId, messageReactions.remoteJid, messageReactions.fromMe],
          set: { emoji, timestamp: new Date() },
        });
    } else {
      await db
        .delete(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, messageId),
            eq(messageReactions.fromMe, true),
          )
        );
    }

    await pusherServer.trigger(`team-${team.id}`, 'message-reaction', {
      messageId,
      chatId: message.chatId,
      emoji: emoji || null,
      fromMe: true,
      remoteJid: null,
      participantName: null,
      action: emoji ? 'add' : 'remove',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending reaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
