import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { evolutionInstances, chats, messages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";

function normalizeJid(jid: string): string {
  if (!jid) return '';
  if (jid.includes('@g.us')) return jid;
  if (jid.includes('@s.whatsapp.net')) {
    const [user] = jid.split('@');
    const cleanUser = user.split(':')[0];
    return `${cleanUser}@s.whatsapp.net`;
  }
  return jid;
}

function extractMessageText(msg: any): string | null {
  if (!msg) return null;
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.documentMessage?.fileName ||
    msg.contactMessage?.displayName ||
    msg.locationMessage?.name ||
    msg.locationMessage?.address ||
    null
  );
}

function getMessageType(evoMsg: any): string {
  return evoMsg.messageType || 'conversation';
}

function getStatusFromUpdate(updates: any[]): string {
  if (!updates || updates.length === 0) return 'delivered';
  const last = updates[updates.length - 1];
  const status = last.status;
  if (status === 'READ' || status === 'PLAYED') return 'read';
  if (status === 'DELIVERY_ACK') return 'delivered';
  if (status === 'SERVER_ACK') return 'sent';
  return 'delivered';
}

export async function POST(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { instanceId, remoteJid, limit = 50 } = await request.json();
    if (!instanceId || !remoteJid) {
      return NextResponse.json({ error: 'instanceId and remoteJid are required' }, { status: 400 });
    }

    const instance = await db.query.evolutionInstances.findFirst({
      where: and(
        eq(evolutionInstances.id, instanceId),
        eq(evolutionInstances.teamId, team.id)
      ),
    });

    if (!instance || !instance.accessToken) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const chat = await db.query.chats.findFirst({
      where: and(
        eq(chats.teamId, team.id),
        eq(chats.remoteJid, remoteJid),
        eq(chats.instanceId, instance.id)
      ),
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found. Import the chat first.' }, { status: 404 });
    }

    const response = await fetch(
      `${EVOLUTION_API_URL}/chat/findMessages/${instance.instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instance.accessToken,
        },
        body: JSON.stringify({
          where: { key: { remoteJid } },
          limit: Math.min(limit, 500),
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || 'Failed to fetch messages from Evolution API' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const evoMessages = data.messages?.records || data;

    if (!Array.isArray(evoMessages)) {
      return NextResponse.json({ error: 'Unexpected response from Evolution API' }, { status: 500 });
    }

    const isGroup = remoteJid.includes('@g.us');
    let imported = 0;
    let skipped = 0;

    const batchSize = 50;
    for (let i = 0; i < evoMessages.length; i += batchSize) {
      const batch = evoMessages.slice(i, i + batchSize);
      const messagesToInsert = [];

      for (const evoMsg of batch) {
        const messageId = evoMsg.key?.id;
        if (!messageId) { skipped++; continue; }

        const msgType = getMessageType(evoMsg);
        if (['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage'].includes(msgType)) {
          skipped++;
          continue;
        }

        const fromMe = evoMsg.key?.fromMe || false;
        const text = extractMessageText(evoMsg.message);
        const timestamp = evoMsg.messageTimestamp
          ? new Date(evoMsg.messageTimestamp * 1000)
          : new Date();

        const status = fromMe
          ? getStatusFromUpdate(evoMsg.MessageUpdate)
          : 'delivered';

        let participant = null;
        let participantName = null;
        if (isGroup && !fromMe) {
          const participantJid = evoMsg.key?.participant || evoMsg.key?.participantAlt;
          if (participantJid && participantJid.includes('@s.whatsapp.net')) {
            participant = normalizeJid(participantJid);
          }
          participantName = evoMsg.pushName || null;
        }

        const msg = evoMsg.message || {};
        let mediaMimetype = null;
        let mediaCaption = null;
        let mediaSeconds = null;
        let mediaIsPtt = null;

        if (msg.imageMessage) {
          mediaMimetype = msg.imageMessage.mimetype || 'image/jpeg';
          mediaCaption = msg.imageMessage.caption || null;
        } else if (msg.videoMessage) {
          mediaMimetype = msg.videoMessage.mimetype || 'video/mp4';
          mediaCaption = msg.videoMessage.caption || null;
          mediaSeconds = msg.videoMessage.seconds || null;
        } else if (msg.audioMessage) {
          mediaMimetype = msg.audioMessage.mimetype || 'audio/ogg';
          mediaSeconds = msg.audioMessage.seconds || null;
          mediaIsPtt = msg.audioMessage.ptt || false;
        } else if (msg.documentMessage) {
          mediaMimetype = msg.documentMessage.mimetype || 'application/octet-stream';
          mediaCaption = msg.documentMessage.fileName || null;
        }

        const contextInfo = msg.extendedTextMessage?.contextInfo ||
          msg.imageMessage?.contextInfo ||
          msg.videoMessage?.contextInfo ||
          msg.audioMessage?.contextInfo ||
          msg.documentMessage?.contextInfo;
        const quotedMessageId = contextInfo?.stanzaId || null;

        const locationMsg = msg.locationMessage;

        const contactMsg = msg.contactMessage;

        messagesToInsert.push({
          id: messageId,
          chatId: chat.id,
          fromMe,
          messageType: msgType,
          text: text || (mediaMimetype ? null : 'Message'),
          timestamp,
          status,
          mediaUrl: null, 
          mediaMimetype,
          mediaCaption,
          mediaFileLength: null,
          mediaSeconds,
          mediaIsPtt,
          contactName: contactMsg?.displayName || null,
          contactVcard: contactMsg?.vcard || null,
          locationLatitude: locationMsg?.degreesLatitude?.toString() || null,
          locationLongitude: locationMsg?.degreesLongitude?.toString() || null,
          locationName: locationMsg?.name || null,
          locationAddress: locationMsg?.address || null,
          quotedMessageId,
          quotedMessageText: null,
          participant,
          participantName,
          isInternal: false,
        });
      }

      if (messagesToInsert.length > 0) {
        await db.insert(messages).values(messagesToInsert).onConflictDoNothing();
        imported += messagesToInsert.length;
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      total: evoMessages.length,
      chatId: chat.id,
    });
  } catch (error: any) {
    console.error('Error in sync-messages:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
