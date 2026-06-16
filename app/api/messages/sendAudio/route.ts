import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { chats, messages, evolutionInstances } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { formatMessageForFrontend } from '@/lib/db/messages';
import { sendAudioViaProvider } from '@/lib/whatsapp/send-helpers';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";

const convertToMp3 = async (inputBuffer: Buffer, inputMimeType: string): Promise<string> => {
  const tempId = uuidv4();
  const tempDir = os.tmpdir();
  
  let inputExt = 'webm';
  if (inputMimeType.includes('mp4') || inputMimeType.includes('aac')) inputExt = 'mp4';
  else if (inputMimeType.includes('ogg')) inputExt = 'ogg';
  else if (inputMimeType.includes('wav')) inputExt = 'wav';

  const inputPath = path.join(tempDir, `${tempId}.${inputExt}`);
  const outputPath = path.join(tempDir, `${tempId}.mp3`);

  await fs.writeFile(inputPath, inputBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .on('end', async () => {
        try {
          const mp3Buffer = await fs.readFile(outputPath);
          const base64 = mp3Buffer.toString('base64');
          await fs.unlink(inputPath).catch(() => {});
          await fs.unlink(outputPath).catch(() => {});
          resolve(base64);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', async (err) => {
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        reject(err);
      })
      .save(outputPath);
  });
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipientJid, audioBase64, audioMimeType, quotedMessageData, instanceId } = body;

    if (!recipientJid || !audioBase64 || !audioMimeType) {
      return NextResponse.json({ error: 'recipientJid, audioBase64 and audioMimeType are required' }, { status: 400 });
    }

    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
      return NextResponse.json({ error: 'Nenhuma instância conectada encontrada.' }, { status: 404 });
    }

    const { instanceName, id: dbInstanceId } = activeInstance;
    const accessToken = activeInstance.accessToken || '';

    let finalAudioBase64 = audioBase64;
    let publicMediaUrl: string | null = null;

    try {
        const inputBuffer = Buffer.from(audioBase64, 'base64');
        finalAudioBase64 = await convertToMp3(inputBuffer, audioMimeType);

        const timestamp = Date.now();
        const uniqueId = uuidv4();
        const filename = `${timestamp}-${uniqueId}.mp3`;
        const relativeDirPath = path.join('uploads', 'audio');
        const absoluteDirPath = path.join(process.cwd(), 'public', relativeDirPath);
        const absoluteFilePath = path.join(absoluteDirPath, filename);

        await fs.mkdir(absoluteDirPath, { recursive: true });
        await fs.writeFile(absoluteFilePath, Buffer.from(finalAudioBase64, 'base64'));

        publicMediaUrl = `/${relativeDirPath}/${filename}`;

    } catch (conversionError: any) {
        console.error(`Audio conversion failed: ${conversionError.message}`);
        return NextResponse.json({ error: 'Failed to process audio file.' }, { status: 500 });
    }

    
    if (activeInstance.integration === 'META-CLOUD') {
      const chatForMeta = targetChat || await db.query.chats.findFirst({
        where: and(eq(chats.teamId, team.id), eq(chats.remoteJid, recipientJid)),
        columns: { id: true },
      });

      const result = await sendAudioViaProvider({
        instance: {
          id: dbInstanceId, instanceName, accessToken: accessToken || '',
          integration: activeInstance.integration,
          metaToken: activeInstance.metaToken, metaPhoneNumberId: activeInstance.metaPhoneNumberId,
        },
        recipientJid, teamId: team.id, chatId: chatForMeta?.id, instanceId: dbInstanceId,
        audioBase64: finalAudioBase64, localAudioUrl: publicMediaUrl || undefined,
        quotedMessageData: quotedMessageData || null,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to send audio' }, { status: 500 });
      }

      return NextResponse.json(formatMessageForFrontend({
        id: result.messageId, chatId: result.chatId, fromMe: true,
        messageType: 'audioMessage', text: '🎤 Audio', timestamp: new Date(),
        status: 'sent', isInternal: false, mediaUrl: publicMediaUrl,
        mediaMimetype: 'audio/mpeg', mediaIsPtt: true,
      }));
    }

    const evolutionPayload: any = {
      number: recipientJid,
      delay: 1200,
      presence: 'recording',
      quoted: quotedMessageData ? { 
          key: { id: quotedMessageData.id },
          message: quotedMessageData.text ? { conversation: quotedMessageData.text } : undefined
      } : undefined,
      audio: finalAudioBase64,
      mimetype: 'audio/mpeg',
      ptt: true,
    };
    
    if (!evolutionPayload.quoted) {
        delete evolutionPayload.quoted;
    }

    const evolutionResponse = await fetch(
      `${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': accessToken,
        },
        body: JSON.stringify(evolutionPayload),
        signal: AbortSignal.timeout(10000),
      }
    );

    const evolutionData = await evolutionResponse.json() as any;

    const sendFailed = !evolutionResponse.ok || !evolutionData?.key?.id;
    let errorMsg: string | null = null;

    if (!evolutionResponse.ok) {
      console.error(`Evolution API Error (sendAudio) for ${instanceName}:`, evolutionData);
      errorMsg = evolutionData?.error || 'Failed to send audio via Evolution API.';
    } else if (!evolutionData?.key?.id) {
      console.error('Unexpected Evolution response (no key.id):', evolutionData);
      errorMsg = 'Message sent but ID not returned.';
    }

    const isGroupChat = recipientJid.endsWith('@g.us');
    const messageStatus = sendFailed ? 'error' as const : (isGroupChat ? 'delivered' as const : 'sent' as const);

    let savedMessage: any = null;

    await db.transaction(async (tx) => {
      let finalChatId = targetChat?.id;

      if (!finalChatId) {
         const [newChat] = await tx.insert(chats).values({
             teamId: team.id,
             remoteJid: recipientJid,
             instanceId: dbInstanceId,
             name: recipientJid.split('@')[0],
             lastMessageText: '🎤 Audio',
             lastMessageTimestamp: new Date(),
             lastMessageFromMe: true,
             unreadCount: 0,
             lastMessageStatus: messageStatus
         }).returning({ id: chats.id });
         finalChatId = Number((newChat as any).id);
      } else {
         await tx.update(chats)
            .set({
              lastMessageText: '🎤 Audio',
              lastMessageTimestamp: new Date(),
              lastMessageFromMe: true,
              unreadCount: 0,
              lastMessageStatus: messageStatus
            })
            .where(eq(chats.id, finalChatId));
      }

      const messageId = sendFailed ? `error_${Date.now()}` : evolutionData.key.id;
      const audioMsg = sendFailed ? null : evolutionData.message?.audioMessage;
      const finalMediaUrl = publicMediaUrl || audioMsg?.url || null;

      const dbQuotedMessageId = quotedMessageData?.id || null;
      const dbQuotedMessageText = quotedMessageData ? JSON.stringify(quotedMessageData) : null;
      const newMessageData = {
        id: messageId,
        chatId: finalChatId as number,
        fromMe: true,
        messageType: 'audioMessage',
        text: null,
        timestamp: new Date(),
        status: messageStatus,
        errorMessage: errorMsg,
        mediaUrl: finalMediaUrl,
        mediaMimetype: 'audio/mpeg',
        mediaCaption: null,
        mediaFileLength: sendFailed ? null : (audioMsg?.fileLength?.toString() || null),
        mediaSeconds: sendFailed ? null : (audioMsg?.seconds || null),
        mediaIsPtt: sendFailed ? true : (audioMsg?.ptt ?? true),
        contactName: null,
        contactVcard: null,
        locationLatitude: null,
        locationLongitude: null,
        locationName: null,
        locationAddress: null,
        quotedMessageId: dbQuotedMessageId,
        quotedMessageText: dbQuotedMessageText,
        isInternal: false,
      };

      const [insertedMessage] = await tx
        .insert(messages)
        .values(newMessageData)
        .onConflictDoNothing()
        .returning();

      savedMessage = insertedMessage || newMessageData;
    });

    return NextResponse.json(formatMessageForFrontend(savedMessage));

  } catch (error: any) {
    console.error('Error in /api/messages/sendAudio:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}