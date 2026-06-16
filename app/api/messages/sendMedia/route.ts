import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { chats, messages, evolutionInstances, type Message } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { formatMessageForFrontend } from '@/lib/db/messages';
import { sendMediaViaProvider } from '@/lib/whatsapp/send-helpers';
import fs from 'fs/promises';
import path from 'path';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";

function getExtensionFromMimetype(mimetype: string | null): string | null {
    if (!mimetype) return null;
    const mimeMap: { [key: string]: string } = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
        'video/mp4': 'mp4', 'video/3gpp': '3gp',
        'application/pdf': 'pdf', 'text/plain': 'txt',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'text/vcard': 'vcf',
    };
    if (mimeMap[mimetype]) return mimeMap[mimetype];
    const subtype = mimetype.split('/')[1]?.split(';')[0];
    return subtype || null;
}

function getMediaType(mimeType: string): { type: 'image' | 'video' | 'document', subDir: string, preview: string, msgType: Message['messageType'] } {
    if (mimeType.startsWith('image/')) return { type: 'image', subDir: 'image', preview: '📷 Imagem', msgType: 'imageMessage' };
    if (mimeType.startsWith('video/')) return { type: 'video', subDir: 'video', preview: '📹 Vídeo', msgType: 'videoMessage' };
    return { type: 'document', subDir: 'document', preview: '📄 Documento', msgType: 'documentMessage' };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipientJid, fileBase64, mimeType, fileName, quotedMessageData, instanceId } = body;

    if (!recipientJid || !fileBase64 || !mimeType || !fileName) {
      return NextResponse.json({ error: 'recipientJid, fileBase64, mimeType and fileName are required' }, { status: 400 });
    }

    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let activeInstance = null;
    let targetChat = null;

    if (instanceId) {
        activeInstance = await db.query.evolutionInstances.findFirst({
            where: and(eq(evolutionInstances.id, Number(instanceId)), eq(evolutionInstances.teamId, team.id))
        });

        if (activeInstance) {
            targetChat = await db.query.chats.findFirst({
                where: and(
                    eq(chats.teamId, team.id),
                    eq(chats.remoteJid, recipientJid),
                    eq(chats.instanceId, activeInstance.id)
                )
            });
        }
    }
    if (!activeInstance) {
        targetChat = await db.query.chats.findFirst({
            where: and(
                eq(chats.teamId, team.id),
                eq(chats.remoteJid, recipientJid)
            ),
            with: {
                instance: true
            }
        });

        if (targetChat && targetChat.instance) {
            activeInstance = targetChat.instance;
        }
    }

    if (!activeInstance) {
        activeInstance = await db.query.evolutionInstances.findFirst({
            where: eq(evolutionInstances.teamId, team.id)
        });
    }

    if (!activeInstance || !activeInstance.instanceName) {
      return NextResponse.json({ error: 'No connected instance found.' }, { status: 404 });
    }

    const { instanceName, id: dbInstanceId } = activeInstance;
    const accessToken = activeInstance.accessToken || '';
    const { type: mediaType, subDir, preview, msgType } = getMediaType(mimeType);

    let publicMediaUrl: string | null = null;
    try {
        const buffer = Buffer.from(fileBase64, 'base64');
        const uniqueId = uuidv4();
        const safeFileName = `${uniqueId}-${fileName.replace(/[^a-z0-9._-]/gi, '_')}`;

        const relativeDirPath = path.join('uploads', subDir);
        const absoluteDirPath = path.join(process.cwd(), 'public', relativeDirPath);
        const absoluteFilePath = path.join(absoluteDirPath, safeFileName);

        await fs.mkdir(absoluteDirPath, { recursive: true });
        await fs.writeFile(absoluteFilePath, buffer);

        const webPath = relativeDirPath.split(path.sep).join('/');
        publicMediaUrl = `/${webPath}/${safeFileName}`;

    } catch (fileError: any) {
        console.error(`Failed to save file locally: ${fileError.message}`);
    }

    
    if (activeInstance.integration === 'META-CLOUD') {
      const chatForMeta = targetChat || await db.query.chats.findFirst({
        where: and(eq(chats.teamId, team.id), eq(chats.remoteJid, recipientJid)),
        columns: { id: true },
      });

      const result = await sendMediaViaProvider({
        instance: {
          id: dbInstanceId, instanceName, accessToken: accessToken || '',
          integration: activeInstance.integration,
          metaToken: activeInstance.metaToken, metaPhoneNumberId: activeInstance.metaPhoneNumberId,
        },
        recipientJid, teamId: team.id, chatId: chatForMeta?.id, instanceId: dbInstanceId,
        mediaBase64: fileBase64, mimetype: mimeType, mediaType: mediaType as any,
        fileName, caption: undefined, localMediaUrl: publicMediaUrl || undefined,
        quotedMessageData: quotedMessageData || null,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to send media' }, { status: 500 });
      }

      return NextResponse.json(formatMessageForFrontend({
        id: result.messageId, chatId: result.chatId, fromMe: true,
        messageType: msgType, text: preview, timestamp: new Date(),
        status: 'sent', isInternal: false, mediaUrl: publicMediaUrl,
        mediaMimetype: mimeType,
      }));
    }

    const evolutionPayload: any = {
      number: recipientJid,
      delay: 1200,
      mediatype: mediaType,
      media: fileBase64,
      mimetype: mimeType,
    };

    if (mediaType === 'document') {
        evolutionPayload.fileName = fileName;
    }

    if (quotedMessageData && quotedMessageData.id) {
        evolutionPayload.quoted = { 
            key: { id: quotedMessageData.id },
            message: quotedMessageData.text ? { conversation: quotedMessageData.text } : undefined
        };
    }

    const evolutionResponse = await fetch(
      `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': accessToken },
        body: JSON.stringify(evolutionPayload),
        signal: AbortSignal.timeout(10000),
      }
    );

    const responseText = await evolutionResponse.text();
    let evolutionData: any;
    try {
      evolutionData = JSON.parse(responseText);
    } catch {
      console.error(`Evolution API returned non-JSON (status ${evolutionResponse.status}) for ${instanceName}:`, responseText.substring(0, 500));
      return NextResponse.json({
        error: `Evolution API error (${evolutionResponse.status}). The instance may not support this media type or the API is unreachable.`
      }, { status: 502 });
    }

    const sendFailed = !evolutionResponse.ok || !evolutionData?.key?.id;
    let errorMsg: string | null = null;

    if (!evolutionResponse.ok) {
      console.error(`Evolution API Error (sendMedia) for ${instanceName}:`, evolutionData);
      errorMsg = evolutionData?.message || evolutionData?.error || 'Evolution API Error';
    } else if (!evolutionData?.key?.id) {
      console.error("Evolution returned 200 OK, but without ID:", evolutionData);
      errorMsg = evolutionData?.message ? `WhatsApp API Error: ${evolutionData.message}` : 'Unexpected Error: API did not return message ID.';
    }

    const isGroupChat = recipientJid.endsWith('@g.us');
    const messageStatus = sendFailed ? 'error' as const : (isGroupChat ? 'delivered' as const : 'sent' as const);

    let savedMessage: any = null;

    await db.transaction(async (tx) => {
      let finalChatId = targetChat?.id;

      if (finalChatId) {
         await tx.update(chats)
            .set({
                lastMessageText: preview,
                lastMessageTimestamp: new Date(),
                lastMessageFromMe: true,
                unreadCount: 0,
                lastMessageStatus: messageStatus
            })
            .where(eq(chats.id, finalChatId));
      } else {
         const [newChat] = await tx.insert(chats).values({
             teamId: team.id,
             remoteJid: recipientJid,
             instanceId: dbInstanceId,
             name: recipientJid.split('@')[0],
             lastMessageText: preview,
             lastMessageTimestamp: new Date(),
             lastMessageFromMe: true,
             unreadCount: 0,
             lastMessageStatus: messageStatus
         }).returning({ id: chats.id });
         finalChatId = (newChat as { id: number }).id;
      }

      const messageId = sendFailed ? `error_${Date.now()}` : evolutionData.key.id;
      const mediaMsg = sendFailed ? null : evolutionData.message?.[msgType!];
      const finalMediaUrl = publicMediaUrl || mediaMsg?.url || null;

      const dbQuotedMessageId = quotedMessageData?.id || null;
      const dbQuotedMessageText = quotedMessageData ? JSON.stringify(quotedMessageData) : null;

      const newMessageData = {
        id: messageId,
        chatId: finalChatId,
        fromMe: true,
        messageType: sendFailed ? msgType : msgType,
        text: (mediaType === 'document') ? fileName : null,
        timestamp: new Date(),
        status: messageStatus,
        errorMessage: errorMsg,
        mediaUrl: finalMediaUrl,
        mediaMimetype: mimeType,
        mediaCaption: sendFailed ? null : (mediaMsg?.caption || null),
        mediaFileLength: sendFailed ? null : (mediaMsg?.fileLength?.toString() || null),
        mediaSeconds: sendFailed ? null : (mediaType === 'video' ? mediaMsg?.seconds : null),
        mediaIsPtt: null,
        contactName: null,
        contactVcard: null,
        locationLatitude: null,
        locationLongitude: null,
        locationName: null,
        locationAddress: null,
        quotedMessageId: dbQuotedMessageId,
        quotedMessageText: dbQuotedMessageText,
        isInternal: false
      };

      const [insertedMessage] = await tx.insert(messages).values(newMessageData as any).onConflictDoNothing().returning();
      savedMessage = insertedMessage || newMessageData;
    });

    return NextResponse.json(formatMessageForFrontend(savedMessage));

  } catch (error: any) {
    console.error('Error in API /api/messages/sendMedia:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}