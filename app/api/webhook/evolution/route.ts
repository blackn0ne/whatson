import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { chats, messages, evolutionInstances, webhookEvents, messageReactions, contacts } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher-server';
import fs from 'fs/promises';
import path from 'path';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { processAutomation } from '@/lib/automation/engine';
import { scheduleAIProcessing } from '@/lib/plugins/ai-chat/service';
import { sendPushNotification, sendPushToTeam } from '@/lib/push-notifications';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

async function downloadProfilePic(url: string): Promise<string | null> {
    if (!url || url.startsWith('/uploads/')) return null;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return null;

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) return null;

        const contentLength = res.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) return null;

        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 100) return null; 

        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const filename = `${Date.now()}-${uuidv4()}.${ext}`;
        const dirPath = path.join(process.cwd(), 'public', 'uploads', 'avatar');
        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(path.join(dirPath, filename), buffer);
        return `/uploads/avatar/${filename}`;
    } catch {
        return null;
    }
}

async function safePusherTrigger(channel: string, event: string, data: any): Promise<void> {
    try {
        await pusherServer.trigger(channel, event, data);
    } catch (err: any) {
        console.error(`[Pusher Error] ${channel}/${event}:`, err.message);
    }
}

async function logWebhookEvent(
    teamId: number,
    instanceName: string,
    event: string,
    messageId: string | null,
    remoteJid: string | null,
    status: 'processed' | 'duplicate' | 'ignored' | 'error',
    error?: string
): Promise<void> {
    try {
        await db.insert(webhookEvents).values({
            teamId,
            instanceName,
            event,
            messageId,
            remoteJid,
            status,
            error: error || null,
            processedAt: status !== 'error' ? new Date() : null,
        });
    } catch (e) {

    }
}

function normalizeJid(jid: string): string {
    if (!jid) return '';
    if (jid.includes('@g.us')) {
        return jid;
    }
    if (jid.includes('@s.whatsapp.net')) {
        const [user] = jid.split('@');
        const cleanUser = user.split(':')[0];
        return `${cleanUser}@s.whatsapp.net`;
    }
    return jid;
}

function getBestRemoteJid(key: any): string {
    const remoteJid = key.remoteJid;

    if (remoteJid && remoteJid.includes('@g.us')) {
        return remoteJid;
    }

    const remoteJidAlt = key.remoteJidAlt;
    const participant = key.participant;

    const candidates = [remoteJid, remoteJidAlt, participant];

    for (const cand of candidates) {
        if (cand && cand.includes('@s.whatsapp.net')) {
            return normalizeJid(cand);
        }
    }
    return normalizeJid(remoteJid);
}

function getParticipantJid(key: any): string | null {
    const participant = key.participant;
    if (participant && participant.includes('@s.whatsapp.net')) {
        return normalizeJid(participant);
    }
    return null;
}

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";

async function fetchGroupName(instanceName: string, accessToken: string, groupJid: string): Promise<string | null> {
    try {
        const res = await fetch(`${EVOLUTION_API_URL}/group/findGroupInfos/${instanceName}?groupJid=${groupJid}`, {
            method: 'GET',
            headers: { 'apikey': accessToken },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.subject || data?.name || null;
    } catch {
        return null;
    }
}

function getMessagePreview(messageData: any): string {
  const messagePayload = messageData.message;
  const messageType = messageData.messageType;

  if (messageType === 'conversation' && messagePayload?.conversation) return messagePayload.conversation;
  if (messageType === 'extendedTextMessage' && messagePayload?.extendedTextMessage?.text) return messagePayload.extendedTextMessage.text;

  if (messageType === 'templateMessage') {
      const template = messagePayload?.templateMessage?.hydratedTemplate;
      if (template) {
          const contentText = template.hydratedContentText || template.hydratedTitleText || 'Template Message';
          return `📋 ${contentText}`;
      }
      return '📋 Template Message';
  }
  
  if (messageType === 'templateButtonReplyMessage') {
      const btn = messagePayload?.templateButtonReplyMessage;
      return `🔘 ${btn?.selectedDisplayText || 'Button Reply'}`;
  }

  const caption = messagePayload?.imageMessage?.caption || messagePayload?.videoMessage?.caption || messagePayload?.documentMessage?.caption || null;

  if (messageType === 'imageMessage') return caption ? `📷 ${caption}` : '📷 Image';
  if (messageType === 'audioMessage') return '🎤 Audio';
  if (messageType === 'stickerMessage') return 'Sticker';
  if (messageType === 'videoMessage') return caption ? `📹 ${caption}` : '📹 Video';
  if (messageType === 'documentMessage') {
      const filename = messagePayload?.documentMessage?.fileName || messagePayload?.documentMessage?.filename || 'Document';
      return caption ? `📄 ${caption}` : `📄 ${filename}`;
  }
  if (messageType === 'contactMessage') return `👤 Contact: ${messagePayload?.contactMessage?.displayName || 'Unknown'}`;
  if (messageType === 'contactsArrayMessage') return '👤 Contacts';
  if (messageType === 'locationMessage') return `📍 Location: ${messagePayload?.locationMessage?.name || messagePayload?.locationMessage?.address || 'Unknown'}`;

  return 'New message';
}

function getExtensionFromMimetype(mimetype: string | null): string | null {
    if (!mimetype) return null;
    const mimeMap: { [key: string]: string } = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
        'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov', 'video/webm': 'webm',
        'audio/aac': 'aac', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/amr': 'amr',
        'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/opus': 'ogg',
        'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'application/zip': 'zip', 'application/vnd.rar': 'rar', 'application/x-7z-compressed': '7z',
        'application/json': 'json', 'text/html': 'html', 'text/xml': 'xml',
        'text/vcard': 'vcf', 'model/stl': 'stl', 'application/sla': 'stl',
        'application/vnd.ms-pki.stl': 'stl',
    };
    if (mimeMap[mimetype]) return mimeMap[mimetype];
    const cleanMime = mimetype.split(';')[0].trim();
    if (mimeMap[cleanMime]) return mimeMap[cleanMime];
    const subtype = cleanMime.split('/')[1];
    if (subtype && /^[a-z0-9]+$/.test(subtype)) {
        if (!['octet-stream', 'vnd.oasis.opendocument.text'].includes(subtype)) {
             return subtype;
        }
    }
    return null;
}

function getStatusWeight(status: string | null): number {
    if (!status) return 0;
    const s = status.toLowerCase();
    if (s === 'error') return -1;
    if (s === 'pending') return 1;
    if (s === 'sent') return 2;
    if (s === 'delivered' || s === 'delivery_ack') return 3;
    if (s === 'read' || s === 'played') return 4;
    return 0;
}

export async function POST(request: Request) {
  try {
    const limited = checkRateLimit(`webhook:${getClientIp(request)}`, RATE_LIMITS.webhook);
    if (limited) return limited;

    const body = await request.json();
    const instanceName = body.instance;
    
    if (!instanceName) {
      return NextResponse.json({ error: 'Instance name missing' }, { status: 400 });
    }

    const instance = await db.query.evolutionInstances.findFirst({
        where: eq(evolutionInstances.instanceName, instanceName),
        columns: {
            id: true,
            teamId: true,
            metaToken: true,
            accessToken: true
        }
    });

    if (!instance || !instance.teamId) {
        return NextResponse.json({ received_but_ignored: true });
    }

    const teamId = instance.teamId;
    const instanceId = instance.id;
    const metaToken = instance.metaToken;
    const pusherChannel = `team-${teamId}`;

    if (body.event === 'messages.upsert' && body.data) {
      const messageData = body.data;
      if (!messageData.key) {
          return NextResponse.json({ received_with_error: 'invalid message structure' });
      }
      
      const remoteJid = getBestRemoteJid(messageData.key);

      if (
          remoteJid === 'status@broadcast' ||
          remoteJid.endsWith('@newsletter') ||
          remoteJid.includes('@lid')
      ) {
          return NextResponse.json({ received_but_ignored: true, reason: 'status_or_lid_message' });
      }

      const isGroup = remoteJid.endsWith('@g.us');
      const participantJid = isGroup ? getParticipantJid(messageData.key) : null;

      const messageType = messageData.messageType;

      const reactionMsg = messageData.message?.reactionMessage;
      if (messageType === 'reactionMessage' || reactionMsg) {
          if (reactionMsg) {
              const targetMessageId = reactionMsg.key?.id;
              const reactionEmoji = reactionMsg.text || '';
              const isFromMe = messageData.key.fromMe;
              const reactorJid = isFromMe ? null : (participantJid || remoteJid);
              const reactorName = isFromMe ? null : (messageData.pushName || null);

              if (targetMessageId) {
                  const targetMsg = await db.query.messages.findFirst({
                      where: eq(messages.id, targetMessageId),
                      columns: { id: true, chatId: true },
                  });

                  if (targetMsg) {
                      if (reactionEmoji) {
                          await db
                              .insert(messageReactions)
                              .values({
                                  messageId: targetMessageId,
                                  chatId: targetMsg.chatId,
                                  emoji: reactionEmoji,
                                  fromMe: isFromMe,
                                  remoteJid: reactorJid,
                                  participantName: reactorName,
                                  timestamp: new Date(),
                              })
                              .onConflictDoUpdate({
                                  target: [messageReactions.messageId, messageReactions.remoteJid, messageReactions.fromMe],
                                  set: { emoji: reactionEmoji, timestamp: new Date() },
                              });
                      } else {
                          await db
                              .delete(messageReactions)
                              .where(
                                  and(
                                      eq(messageReactions.messageId, targetMessageId),
                                      isFromMe
                                          ? eq(messageReactions.fromMe, true)
                                          : eq(messageReactions.remoteJid, reactorJid!),
                                  )
                              );
                      }

                      await safePusherTrigger(pusherChannel, 'message-reaction', {
                          messageId: targetMessageId,
                          chatId: targetMsg.chatId,
                          emoji: reactionEmoji || null,
                          fromMe: isFromMe,
                          remoteJid: reactorJid,
                          participantName: reactorName,
                          action: reactionEmoji ? 'add' : 'remove',
                      });
                  }
              }
          }
          return NextResponse.json({ received: true, reaction_processed: true });
      }

      if (
          messageType === 'protocolMessage' ||
          messageType === 'senderKeyDistributionMessage' ||
          !messageData.message
      ) {
          return NextResponse.json({ received_but_ignored: true, reason: 'protocol_message' });
      }

      let groupName: string | null = null;
      if (isGroup) {
          groupName = messageData.groupMetadata?.subject || null;
          if (!groupName && instance.accessToken) {
              groupName = await fetchGroupName(instanceName, instance.accessToken, remoteJid);
          }
      }

      let chatIdForAutomation: number | null = null;
      let textForAutomation: string | null = null;
      let mediaDetails: any = {};
      let newMessageData: any = null;
      let chatUpdateData: any = null;
      let rawMessagePreview: string = '';

      const messagePayload = messageData.message;

      const mediaContent = messagePayload.imageMessage ||
                           messagePayload.audioMessage ||
                           messagePayload.videoMessage ||
                           messagePayload.documentMessage ||
                           messagePayload.stickerMessage;

      const rawBase64 = messagePayload.base64 || mediaContent?.base64;
      const mediaUrl = mediaContent?.url;

      if ((rawBase64 || mediaUrl) && mediaContent) {
          try {
              let buffer: Buffer | null = null;

              if (rawBase64) {
                  const base64String = rawBase64.startsWith('data:') ? rawBase64.split(',')[1] || rawBase64 : rawBase64;
                  buffer = Buffer.from(base64String, 'base64');
              }
              else if (mediaUrl) {
                  const headers: HeadersInit = {
                      'User-Agent': 'Evolution-Client/1.0'
                  };

                  if (metaToken) {
                      headers['Authorization'] = `Bearer ${metaToken}`;
                  }

                  const response = await fetch(mediaUrl, { headers, signal: AbortSignal.timeout(15000) });

                  if (response.ok) {
                      const contentLength = response.headers.get('content-length');
                      if (contentLength && parseInt(contentLength, 10) > 50 * 1024 * 1024) {
                          buffer = null;
                      } else {
                          const arrayBuffer = await response.arrayBuffer();
                          buffer = Buffer.from(arrayBuffer);
                      }
                  }
              }

              if (buffer) {
                  const mimetype = mediaContent.mimetype || mediaContent.mime_type;
                  const extension = getExtensionFromMimetype(mimetype);

                  if (extension) {
                      const timestamp = Date.now();
                      const uniqueId = uuidv4();
                      const filename = `${timestamp}-${uniqueId}.${extension}`;
                      const subDir = messageType.replace('Message', '').toLowerCase();
                      const relativeDirPath = path.join('uploads', subDir);
                      const absoluteDirPath = path.join(process.cwd(), 'public', relativeDirPath);
                      const absoluteFilePath = path.join(absoluteDirPath, filename);

                      await fs.mkdir(absoluteDirPath, { recursive: true });
                      await fs.writeFile(absoluteFilePath, buffer);

                      mediaDetails.mediaUrl = `/${relativeDirPath}/${filename}`;
                      mediaDetails.mediaMimetype = mimetype;

                      if (messageType === 'imageMessage') {
                          mediaDetails.mediaCaption = mediaContent.caption || messagePayload.caption || null;
                          mediaDetails.mediaFileLength = mediaContent.fileLength?.toString();
                      } else if (messageType === 'audioMessage') {
                          mediaDetails.mediaSeconds = mediaContent.seconds;
                          mediaDetails.mediaIsPtt = mediaContent.ptt || mediaContent.voice;
                          mediaDetails.mediaFileLength = mediaContent.fileLength?.toString();
                      } else if (messageType === 'videoMessage') {
                          mediaDetails.mediaCaption = mediaContent.caption || messagePayload.caption || null;
                          mediaDetails.mediaSeconds = mediaContent.seconds;
                          mediaDetails.mediaFileLength = mediaContent.fileLength?.toString();
                      } else if (messageType === 'documentMessage') {
                          mediaDetails.mediaCaption = mediaContent.caption || messagePayload.caption || null;
                          const originalName = mediaContent.fileName || mediaContent.filename || 'document';
                          mediaDetails.text = originalName;
                          mediaDetails.mediaFileLength = mediaContent.fileLength?.toString();
                      }
                  }
              }
          } catch (fileError: any) {
              console.error('Error saving media:', fileError);
              mediaDetails.mediaUrl = null;
          }
      }

      await db.transaction(async (tx) => {
        const incrementValue = messageData.key.fromMe ? 0 : 1;
        const isFromMe = messageData.key.fromMe;
        const messageTimestamp = messageData.messageTimestamp ? new Date(messageData.messageTimestamp * 1000) : new Date();
        rawMessagePreview = getMessagePreview(messageData);
        const messagePreview = isGroup && !isFromMe && messageData.pushName
            ? `${messageData.pushName}: ${rawMessagePreview}`
            : rawMessagePreview;

        const customerInteractionUpdate = !isFromMe ? messageTimestamp : undefined;

        let initialChatName = remoteJid.split('@')[0];
        if (!isGroup && !isFromMe && messageData.pushName) {
            initialChatName = messageData.pushName;
        }
        if (isGroup && groupName) {
            initialChatName = groupName;
        }

        const updateData: any = {
            lastMessageText: messagePreview,
            lastMessageTimestamp: messageTimestamp,
            unreadCount: sql`${chats.unreadCount} + ${incrementValue}`,
            lastMessageFromMe: isFromMe,
            lastMessageStatus: isFromMe ? (isGroup ? 'delivered' : 'sent') : null,
        };

        if (!isGroup && !isFromMe && messageData.pushName) {
            updateData.name = messageData.pushName;
            updateData.pushName = messageData.pushName;
        }
        if (isGroup && groupName) {
            updateData.name = groupName;
        }

        if (customerInteractionUpdate) {
            updateData.lastCustomerInteraction = customerInteractionUpdate;
        }

        const [chat] = await tx
          .insert(chats)
          .values({
            teamId: teamId,
            remoteJid: remoteJid,
            instanceId: instanceId,
            name: initialChatName,
            pushName: messageData.pushName,
            lastMessageText: messagePreview,
            lastMessageTimestamp: messageTimestamp,
            unreadCount: incrementValue,
            lastMessageFromMe: isFromMe,
            lastMessageStatus: isFromMe ? (isGroup ? 'delivered' : 'sent') : null,
            lastCustomerInteraction: customerInteractionUpdate,
          })
          .onConflictDoUpdate({
            target: [chats.teamId, chats.remoteJid, chats.instanceId],
            set: updateData,
          })
          .returning({
            id: chats.id,
            remoteJid: chats.remoteJid,
            lastMessageStatus: chats.lastMessageStatus,
            lastMessageFromMe: chats.lastMessageFromMe,
            unreadCount: chats.unreadCount,
            instanceId: chats.instanceId,
            lastCustomerInteraction: chats.lastCustomerInteraction,
            name: chats.name,
            profilePicUrl: chats.profilePicUrl
          });

        chatIdForAutomation = chat.id;

        let mainTextContent = messagePayload?.conversation || messagePayload?.extendedTextMessage?.text || null;
        
        if (messageType === 'templateMessage') {
            const template = messagePayload?.templateMessage?.hydratedTemplate;
            mainTextContent = template?.hydratedContentText || template?.hydratedTitleText || 'Template Message';
        } else if (messageType === 'templateButtonReplyMessage') {
            mainTextContent = messagePayload?.templateButtonReplyMessage?.selectedDisplayText || 'Button Reply';
        }

        let contactData: any = {};
        let locationData: any = {};

        if (messageType === 'contactMessage' && messagePayload?.contactMessage) {
          contactData.contactName = messagePayload.contactMessage.displayName;
          contactData.contactVcard = messagePayload.contactMessage.vcard;
        } else if (messageType === 'locationMessage' && messagePayload?.locationMessage) {
          locationData.locationLatitude = messagePayload.locationMessage.degreesLatitude?.toString();
          locationData.locationLongitude = messagePayload.locationMessage.degreesLongitude?.toString();
          locationData.locationName = messagePayload.locationMessage.name || null;
          locationData.locationAddress = messagePayload.locationMessage.address || null;
        }

        if (!mainTextContent) {
            if (messageType === 'documentMessage') {
                 mainTextContent = mediaDetails.text || mediaDetails.mediaCaption;
            } else {
                 mainTextContent = mediaDetails.mediaCaption || null;
            }
        }

        textForAutomation = mainTextContent;

        const quotedMessageText = messageType === 'templateMessage' 
            ? JSON.stringify(messagePayload?.templateMessage) 
            : (messageData.quotedMessage ? JSON.stringify(messageData.quotedMessage) : null);

        const newMessage = {
          id: messageData.key.id,
          chatId: chat.id,
          fromMe: isFromMe,
          messageType: messageType,
          text: mainTextContent,
          timestamp: messageTimestamp,
          status: isFromMe ? (isGroup ? 'delivered' : 'sent') : 'delivered',
          quotedMessageText: quotedMessageText,
          quotedMessageId: messageData.quotedMessage ? 'quoted' : null,
          participant: participantJid,
          participantName: isGroup ? (messageData.pushName || null) : null,
          ...mediaDetails, ...contactData, ...locationData,
        };

        const [insertedMessage] = await tx.insert(messages).values(newMessage).onConflictDoNothing().returning({ id: messages.id });

        if (!insertedMessage) {
            return;
        }

        newMessageData = { ...newMessage, remoteJid: remoteJid, instance: instanceName, instanceId: instanceId, lastMessageTextPreview: messagePreview };

        chatUpdateData = {
            id: chat.id, 
            lastMessageStatus: chat.lastMessageStatus,
            lastMessageFromMe: chat.lastMessageFromMe, 
            unreadCount: chat.unreadCount,
            remoteJid: chat.remoteJid, 
            lastMessageText: messagePreview,
            lastMessageTimestamp: messageTimestamp.toISOString(),
            instanceId: chat.instanceId,
            name: chat.name,
            profilePicUrl: chat.profilePicUrl
        };
      });

      if (newMessageData) {
          await safePusherTrigger(pusherChannel, 'new-message', newMessageData);
      }

      if (chatUpdateData) {
          await safePusherTrigger(pusherChannel, 'chat-list-update', chatUpdateData);
      }

      if (newMessageData) {
          await logWebhookEvent(teamId, instanceName, 'messages.upsert', messageData.key.id, remoteJid, 'processed');
      } else {
          await logWebhookEvent(teamId, instanceName, 'messages.upsert', messageData.key.id, remoteJid, 'duplicate');
      }

      
      if (newMessageData && !messageData.key.fromMe && chatIdForAutomation) {
        try {
          const chatName = chatUpdateData?.name || remoteJid.split('@')[0];
          const pushBody = (rawMessagePreview || 'New message').substring(0, 100);
          const pushData = {
            chatId: chatIdForAutomation,
            jid: remoteJid,
            name: chatName,
            instanceId: String(instanceId),
          };

          
          const contact = await db.query.contacts.findFirst({
            where: eq(contacts.chatId, chatIdForAutomation),
            columns: { assignedUserId: true },
          });

          if (contact?.assignedUserId) {
            
            await sendPushNotification(
              contact.assignedUserId,
              chatName,
              pushBody,
              pushData
            );
          } else {
            
            
            await sendPushToTeam(teamId, 0, chatName, pushBody, pushData);
          }
        } catch (pushError: any) {
          console.error('[Push Notification] Webhook error:', pushError.message);
        }
      }

      if (!isGroup && !messageData.key.fromMe && chatIdForAutomation) {
        let automationProcessed = false;

        if (textForAutomation) {
            const fullInstance = await db.query.evolutionInstances.findFirst({
                where: eq(evolutionInstances.id, instanceId),
                columns: { instanceName: true, accessToken: true }
            });

            if (fullInstance && fullInstance.accessToken) {
                automationProcessed = await processAutomation(
                    teamId,
                    chatIdForAutomation,
                    remoteJid,
                    textForAutomation,
                    { instanceName: fullInstance.instanceName, accessToken: fullInstance.accessToken },
                    instanceId
                );
            }
        }

        if (!automationProcessed) {
            scheduleAIProcessing(teamId, chatIdForAutomation, instanceId);
        }
      }

    } else if (body.event === 'messages.update' && body.data) {
      const updates = Array.isArray(body.data) ? body.data : [body.data];

      for (const updateData of updates) {
          const messageKeyId = updateData.key?.id || updateData.keyId;
          const remoteJidRaw = updateData.key?.remoteJid || updateData.remoteJid;

          const newApiStatus = updateData.status || updateData.update?.status;

          if (!messageKeyId || !newApiStatus) {
             continue;
          }

          if (remoteJidRaw && (remoteJidRaw === 'status@broadcast' || remoteJidRaw.endsWith('@newsletter'))) {
              continue;
          }

          let dbStatus: 'sent' | 'delivered' | 'read' | null = null;

          const statusValue = String(newApiStatus).toUpperCase();

          if (statusValue === 'SENT' || statusValue === 'SERVER_ACK' || statusValue === '2') dbStatus = 'sent';
          else if (statusValue === 'DELIVERY_ACK' || statusValue === 'DELIVERED' || statusValue === '3') dbStatus = 'delivered';
          else if (statusValue === 'READ' || statusValue === 'PLAYED' || statusValue === '4' || statusValue === '5') dbStatus = 'read';

          if (dbStatus) {
            const pusherEvents: { event: string; data: any }[] = [];

            await db.transaction(async (tx) => {
                const currentMessage = await tx.query.messages.findFirst({
                   where: and(
                      eq(messages.id, messageKeyId),
                      eq(messages.fromMe, true)
                   ),
                   columns: { id: true, status: true, timestamp: true, chatId: true }
                });

                if (!currentMessage) return;

                const currentWeight = getStatusWeight(currentMessage.status);
                const newWeight = getStatusWeight(dbStatus!);

                if (newWeight <= currentWeight) return;

                const updatedMessages = await tx.update(messages)
                    .set({ status: dbStatus! })
                    .where(eq(messages.id, messageKeyId))
                    .returning({
                        id: messages.id, status: messages.status, chatId: messages.chatId,
                        timestamp: messages.timestamp
                    });

                if (updatedMessages.length === 0) return;

                const updatedMsg = updatedMessages[0];

                const chat = await tx.query.chats.findFirst({
                    where: eq(chats.id, currentMessage.chatId),
                    columns: { id: true, lastMessageStatus: true, remoteJid: true }
                });

                if (!chat) return;

                pusherEvents.push({
                    event: 'message-status-update',
                    data: {
                        messageId: updatedMsg.id,
                        status: updatedMsg.status,
                        instance: instanceName,
                        remoteJid: chat.remoteJid
                    }
                });

                const latestMessage = await tx.query.messages.findFirst({
                    where: eq(messages.chatId, chat.id),
                    orderBy: [desc(messages.timestamp)],
                    columns: { id: true }
                });

                if (latestMessage && latestMessage.id === messageKeyId) {
                    const chatCurrentWeight = getStatusWeight(chat.lastMessageStatus);
                    if (newWeight > chatCurrentWeight) {
                        const updatedChats = await tx.update(chats)
                            .set({ lastMessageStatus: dbStatus! })
                            .where(eq(chats.id, chat.id))
                            .returning({
                                id: chats.id,
                                lastMessageStatus: chats.lastMessageStatus,
                                remoteJid: chats.remoteJid,
                                instanceId: chats.instanceId
                            });

                        if (updatedChats.length > 0) {
                            pusherEvents.push({
                                event: 'chat-list-update',
                                data: {
                                    id: updatedChats[0].id,
                                    lastMessageStatus: updatedChats[0].lastMessageStatus,
                                    remoteJid: updatedChats[0].remoteJid,
                                    instanceId: updatedChats[0].instanceId
                                }
                            });
                        }
                    }
                }
            });

            for (const evt of pusherEvents) {
                await safePusherTrigger(pusherChannel, evt.event, evt.data);
            }

            if (pusherEvents.length > 0) {
                await logWebhookEvent(teamId, instanceName, 'messages.update', messageKeyId, remoteJidRaw || null, 'processed');
            }
          }
      }

    } else if (body.event === 'contacts.update') {
        const contactsData = Array.isArray(body.data) ? body.data : [body.data];
        
        for (const contact of contactsData) {
            const rawId = contact.remoteJid || contact.id; 
            if (rawId && (contact.profilePicUrl || contact.imgUrl)) {

                const remoteJid = normalizeJid(rawId);
                if (remoteJid === 'status@broadcast' || remoteJid.includes('@lid')) continue;

                const externalUrl = contact.profilePicUrl || contact.imgUrl;
                const newPicUrl = await downloadProfilePic(externalUrl);
                if (!newPicUrl) continue; 

                const updatedChats = await db.update(chats)
                    .set({ profilePicUrl: newPicUrl })
                    .where(and(
                        eq(chats.remoteJid, remoteJid),
                        eq(chats.teamId, teamId),
                        eq(chats.instanceId, instanceId)
                    ))
                    .returning({ id: chats.id });

                if (updatedChats.length > 0) {
                    await safePusherTrigger(pusherChannel, 'chat-list-update', {
                        remoteJid: remoteJid,
                        instanceId: instanceId,
                        profilePicUrl: newPicUrl
                    });
                }
            }
        }
    } else if (body.event === 'chats.update') {
        const chatsData = Array.isArray(body.data) ? body.data : [body.data];
        for (const chatData of chatsData) {
             const rawId = chatData.remoteJid || chatData.id;
             if(rawId && (chatData.profilePicUrl || chatData.image)) {
                 const remoteJid = normalizeJid(rawId);
                 if (remoteJid.includes('@lid')) continue;

                 const externalUrl = chatData.profilePicUrl || chatData.image;
                 const newPicUrl = await downloadProfilePic(externalUrl);
                 if (!newPicUrl) continue; 

                 const updatedChats = await db.update(chats)
                    .set({ profilePicUrl: newPicUrl })
                    .where(and(
                        eq(chats.remoteJid, remoteJid),
                        eq(chats.teamId, teamId),
                        eq(chats.instanceId, instanceId)
                    ))
                    .returning({ id: chats.id });

                 if (updatedChats.length > 0) {
                    await safePusherTrigger(pusherChannel, 'chat-list-update', {
                        remoteJid: remoteJid,
                        instanceId: instanceId,
                        profilePicUrl: newPicUrl
                    });
                 }
             }
        }

    } else if (body.event === 'qrcode.updated' && body.data?.qrcode?.base64) {
      await safePusherTrigger(pusherChannel, 'qr-update-needed', { instance: instanceName });
    } else if (body.event === 'connection.update' && body.data?.state) {
      await safePusherTrigger(pusherChannel, 'connection-status', { status: body.data.state, instance: instanceName });
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook Error:', error.message);
    try {
        await logWebhookEvent(0, 'unknown', 'unknown', null, null, 'error', error.message);
    } catch (_) {  }
    return NextResponse.json({ received: true, error: 'Internal processing error' });
  }
}