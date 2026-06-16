

import { db } from '@/lib/db/drizzle';
import { chats, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher-server';
import { getWhatsAppProvider } from './provider-factory';
import type { WhatsAppInstanceConfig, SendResult } from './types';

interface MetaSendTextParams {
  instance: WhatsAppInstanceConfig;
  recipientJid: string;
  text: string;
  teamId: number;
  chatId?: number;
  instanceId: number;
  quotedMessageData?: { id: string; text?: string } | null;
}

interface MetaSendMediaParams {
  instance: WhatsAppInstanceConfig;
  recipientJid: string;
  teamId: number;
  chatId?: number;
  instanceId: number;
  mediaBase64: string;
  mimetype: string;
  mediaType: 'image' | 'video' | 'document';
  fileName?: string;
  caption?: string;
  localMediaUrl?: string;
  quotedMessageData?: { id: string; text?: string } | null;
}

interface MetaSendAudioParams {
  instance: WhatsAppInstanceConfig;
  recipientJid: string;
  teamId: number;
  chatId?: number;
  instanceId: number;
  audioBase64: string;
  localAudioUrl?: string;
  quotedMessageData?: { id: string; text?: string } | null;
}

export async function sendTextViaProvider(params: MetaSendTextParams) {
  const { instance, recipientJid, text, teamId, chatId, instanceId, quotedMessageData } = params;

  const provider = await getWhatsAppProvider(instance);
  const result = await provider.sendText(recipientJid, {
    text,
    quoted: quotedMessageData || undefined,
  });

  return persistSendResult({
    result,
    recipientJid,
    text,
    messageType: 'conversation',
    teamId,
    chatId,
    instanceId,
    quotedMessageData,
  });
}

export async function sendMediaViaProvider(params: MetaSendMediaParams) {
  const { instance, recipientJid, teamId, chatId, instanceId, mediaBase64, mimetype, mediaType, fileName, caption, localMediaUrl, quotedMessageData } = params;

  const provider = await getWhatsAppProvider(instance);
  const result = await provider.sendMedia(recipientJid, {
    mediaBase64,
    mimetype,
    mediaType,
    fileName,
    caption,
    quoted: quotedMessageData || undefined,
  });

  const previewText = caption || (mediaType === 'document' ? fileName || 'Document' : `${mediaType} message`);

  return persistSendResult({
    result,
    recipientJid,
    text: previewText || 'Media',
    messageType: `${mediaType}Message`,
    teamId,
    chatId,
    instanceId,
    quotedMessageData,
    mediaDetails: localMediaUrl ? {
      mediaUrl: localMediaUrl,
      mediaMimetype: mimetype,
      mediaCaption: caption || null,
    } : undefined,
  });
}

export async function sendAudioViaProvider(params: MetaSendAudioParams) {
  const { instance, recipientJid, teamId, chatId, instanceId, audioBase64, localAudioUrl, quotedMessageData } = params;

  const provider = await getWhatsAppProvider(instance);
  const result = await provider.sendAudio(recipientJid, {
    audioBase64,
    quoted: quotedMessageData || undefined,
  });

  return persistSendResult({
    result,
    recipientJid,
    text: '🎤 Audio',
    messageType: 'audioMessage',
    teamId,
    chatId,
    instanceId,
    quotedMessageData,
    mediaDetails: localAudioUrl ? {
      mediaUrl: localAudioUrl,
      mediaMimetype: 'audio/mpeg',
      mediaIsPtt: true,
    } : undefined,
  });
}

interface PersistParams {
  result: SendResult;
  recipientJid: string;
  text: string;
  messageType: string;
  teamId: number;
  chatId?: number;
  instanceId: number;
  quotedMessageData?: { id: string; text?: string } | null;
  mediaDetails?: Record<string, any>;
}

async function persistSendResult(params: PersistParams) {
  const { result, recipientJid, text, messageType, teamId, chatId, instanceId, quotedMessageData, mediaDetails } = params;

  const isGroupChat = recipientJid.endsWith('@g.us');
  const messageStatus = result.success ? (isGroupChat ? 'delivered' as const : 'sent' as const) : 'error' as const;
  const messageId = result.success && result.messageId ? result.messageId : `error_${Date.now()}`;
  const timestamp = new Date();

  let finalChatId = chatId;

  await db.transaction(async (tx) => {
    if (!finalChatId) {
      const [newChat] = await tx.insert(chats).values({
        teamId,
        remoteJid: recipientJid,
        instanceId,
        name: recipientJid.split('@')[0],
        lastMessageText: text,
        lastMessageTimestamp: timestamp,
        lastMessageFromMe: true,
        unreadCount: 0,
        lastMessageStatus: messageStatus,
      }).returning({ id: chats.id });
      finalChatId = newChat.id;
    } else {
      await tx.update(chats).set({
        lastMessageText: text,
        lastMessageTimestamp: timestamp,
        lastMessageFromMe: true,
        unreadCount: 0,
        lastMessageStatus: messageStatus,
      }).where(eq(chats.id, finalChatId));
    }

    const newMessageData: any = {
      id: messageId,
      chatId: finalChatId,
      fromMe: true,
      messageType,
      text,
      timestamp,
      status: messageStatus,
      isInternal: false,
      quotedMessageId: quotedMessageData?.id || null,
      quotedMessageText: quotedMessageData ? JSON.stringify(quotedMessageData) : null,
      errorMessage: result.success ? null : result.error,
      ...mediaDetails,
    };

    await tx.insert(messages).values(newMessageData).onConflictDoNothing();

    
    const pusherChannel = `team-${teamId}`;
    try {
      await pusherServer.trigger(pusherChannel, 'new-message', {
        ...newMessageData,
        timestamp: timestamp.toISOString(),
        remoteJid: recipientJid,
      });
      await pusherServer.trigger(pusherChannel, 'chat-list-update', {
        id: finalChatId,
        remoteJid: recipientJid,
        lastMessageText: text,
        lastMessageTimestamp: timestamp.toISOString(),
        lastMessageFromMe: true,
        lastMessageStatus: messageStatus,
      });
    } catch {}
  });

  return {
    success: result.success,
    messageId,
    chatId: finalChatId,
    error: result.error,
  };
}
