import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { evolutionInstances, chats } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { instanceId } = await request.json();
    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    const instance = await db.query.evolutionInstances.findFirst({
      where: and(
        eq(evolutionInstances.id, instanceId),
        eq(evolutionInstances.teamId, team.id)
      ),
    });

    if (!instance || !instance.accessToken) {
      return NextResponse.json({ error: 'Instance not found or not configured' }, { status: 404 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': instance.accessToken,
    };

    const [chatsResponse, contactsResult] = await Promise.all([
      fetch(`${EVOLUTION_API_URL}/chat/findChats/${instance.instanceName}`, {
        method: 'POST',
        headers,
      }),
      fetch(`${EVOLUTION_API_URL}/chat/findContacts/${instance.instanceName}`, {
        method: 'POST',
        headers,
      }).then(res => res.ok ? res.json() : []).catch(() => []),
    ]);

    if (!chatsResponse.ok) {
      const err = await chatsResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || 'Failed to fetch chats from Evolution API' },
        { status: chatsResponse.status }
      );
    }

    const evoChats = await chatsResponse.json();

    const contactNameMap = new Map<string, string>();
    if (Array.isArray(contactsResult)) {
      for (const contact of contactsResult) {
        const jid = contact.remoteJid;
        if (!jid || !jid.includes('@s.whatsapp.net')) continue;
        const name = contact.pushName || contact.name || contact.verifiedName;
        if (name) {
          contactNameMap.set(jid, name);
        }
      }
    }

    const existingChats = await db.query.chats.findMany({
      where: and(
        eq(chats.teamId, team.id),
        eq(chats.instanceId, instance.id)
      ),
      columns: { remoteJid: true },
    });
    const existingJids = new Set(existingChats.map((c) => c.remoteJid));

    const mappedChats = evoChats
      .filter((chat: any) => {
        const jid = chat.remoteJid;
        if (!jid) return false;
        if (jid.includes('@lid')) return false;
        if (jid.includes('@broadcast')) return false;
        if (jid.includes('@newsletter')) return false;
        return jid.includes('@s.whatsapp.net') || jid.includes('@g.us');
      })
      .map((chat: any) => {
        const isGroup = chat.remoteJid.includes('@g.us');
        const lastMsg = chat.lastMessage;
        let lastMessageText = null;
        let lastMessageTimestamp = null;
        let lastMessageFromMe = null;

        if (lastMsg) {
          lastMessageFromMe = lastMsg.key?.fromMe || false;
          lastMessageTimestamp = lastMsg.messageTimestamp
            ? new Date(lastMsg.messageTimestamp * 1000).toISOString()
            : null;

          const msg = lastMsg.message;
          if (msg) {
            lastMessageText =
              msg.conversation ||
              msg.extendedTextMessage?.text ||
              (msg.imageMessage ? '📷 Image' : null) ||
              (msg.videoMessage ? '📹 Video' : null) ||
              (msg.audioMessage ? '🎤 Audio' : null) ||
              (msg.documentMessage ? `📄 ${msg.documentMessage.fileName || 'Document'}` : null) ||
              (msg.contactMessage ? `👤 ${msg.contactMessage.displayName || 'Contact'}` : null) ||
              (msg.locationMessage ? '📍 Location' : null) ||
              (msg.stickerMessage ? 'Sticker' : null) ||
              null;
          }
        }

        return {
          remoteJid: chat.remoteJid,
          name: chat.pushName || chat.name || contactNameMap.get(chat.remoteJid) || (isGroup ? chat.remoteJid : chat.remoteJid.split('@')[0]),
          profilePicUrl: chat.profilePicUrl || null,
          isGroup,
          unreadCount: chat.unreadCount || 0,
          lastMessageText,
          lastMessageTimestamp,
          lastMessageFromMe,
          alreadyImported: existingJids.has(chat.remoteJid),
          updatedAt: chat.updatedAt || null,
        };
      })
      .sort((a: any, b: any) => {
        const ta = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : 0;
        const tb = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : 0;
        return tb - ta;
      });

    return NextResponse.json({
      chats: mappedChats,
      total: mappedChats.length,
      alreadyImported: mappedChats.filter((c: any) => c.alreadyImported).length,
    });
  } catch (error: any) {
    console.error('Error in sync-chats:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
