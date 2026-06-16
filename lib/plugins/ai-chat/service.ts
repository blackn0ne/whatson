import { db } from '@/lib/db/drizzle';
import { aiConfigs, aiSessions, chats, messages, evolutionInstances } from '@/lib/db/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { logAIInteraction } from '@/lib/audit/logger';
import { getDynamicTools } from './tools';
import { AIMessage, AIProvider } from './types';
import { pusherServer } from '@/lib/pusher-server';
import { createSystemMessage } from '@/lib/db/system-messages';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";
const AI_DEBOUNCE_MS = 5000;
const pendingAIChats = new Map<number, NodeJS.Timeout>();

async function sendAiTextMessage(instance: any, remoteJid: string, text: string, teamId: number, chatId: number) {
    if (!instance.accessToken) return;

    const cleanText = text.replace(/\[SYSTEM_INSTRUCTION\]/g, '').replace(/Output EXACTLY this text: "/g, '').replace(/"$/g, '').trim();

    const payload = {
        number: remoteJid.replace(/\D/g, ''),
        text: cleanText,
        delay: 1000,
        linkPreview: true
    };

    try {
        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance.instanceName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': instance.accessToken },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
        });

        const data = await response.json();

        if (response.ok && data?.key?.id) {
            const messageId = data.key.id;
            const timestamp = new Date();
            
            const newMessage = {
                id: messageId, 
                chatId: chatId, 
                fromMe: true, 
                messageType: 'conversation', 
                text: cleanText, 
                timestamp, 
                status: 'sent' as const, 
                isInternal: false,
                isAi: true, 
                quotedMessageText: null
            };

            await db.insert(messages).values(newMessage).onConflictDoNothing();

            await db.update(chats).set({ 
                lastMessageText: cleanText, 
                lastMessageTimestamp: timestamp, 
                lastMessageFromMe: true, 
                lastMessageStatus: 'sent' 
            }).where(eq(chats.id, chatId));

            const pusherChannel = `team-${teamId}`;
            await pusherServer.trigger(pusherChannel, 'new-message', { 
                ...newMessage,
                timestamp: timestamp.toISOString(),
                remoteJid, 
                instance: instance.instanceName,
            });
            
            await pusherServer.trigger(pusherChannel, 'chat-list-update', { 
                id: chatId, 
                lastMessageText: cleanText, 
                lastMessageTimestamp: timestamp.toISOString(), 
                lastMessageFromMe: true, 
                lastMessageStatus: 'sent', 
                remoteJid 
            });
        }
    } catch (e) {
        console.error("Error sending AI text", e);
    }
}

export function scheduleAIProcessing(teamId: number, chatId: number, instanceId: number) {
  const existing = pendingAIChats.get(chatId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    pendingAIChats.delete(chatId);

    try {
      const lastOwnMessage = await db.query.messages.findFirst({
        where: and(eq(messages.chatId, chatId), eq(messages.fromMe, true)),
        orderBy: [desc(messages.timestamp)],
        columns: { timestamp: true },
      });

      const pendingWhere = lastOwnMessage
        ? and(eq(messages.chatId, chatId), eq(messages.fromMe, false), gt(messages.timestamp, lastOwnMessage.timestamp))
        : and(eq(messages.chatId, chatId), eq(messages.fromMe, false));

      const pendingMessages = await db.query.messages.findMany({
        where: pendingWhere,
        orderBy: [messages.timestamp],
        columns: { text: true, mediaUrl: true },
        limit: 20,
      });

      if (pendingMessages.length === 0) return;

      const combinedText = pendingMessages
        .map(m => m.text || '[media]')
        .join('\n');

      const latestMedia = [...pendingMessages].reverse().find(m => m.mediaUrl);

      const aiResponse = await processAIMessage(teamId, chatId, combinedText, latestMedia?.mediaUrl);

      if (aiResponse) {
        const instance = await db.query.evolutionInstances.findFirst({
          where: eq(evolutionInstances.id, instanceId),
        });

        if (instance?.accessToken) {
          const chat = await db.query.chats.findFirst({
            where: eq(chats.id, chatId),
            columns: { remoteJid: true },
          });

          if (chat) {
            await sendAiTextMessage(
              { instanceName: instance.instanceName, accessToken: instance.accessToken },
              chat.remoteJid,
              aiResponse,
              teamId,
              chatId
            );
          }
        }
      }
    } catch (e: any) {
      console.error("AI Debounce Processing Error:", e);
    }
  }, AI_DEBOUNCE_MS);

  pendingAIChats.set(chatId, timer);
}

export async function processAIMessage(
  teamId: number,
  chatId: number,
  userMessage: string,
  audioUrl?: string | null
) {

  const config = await db.query.aiConfigs.findFirst({
    where: and(eq(aiConfigs.teamId, teamId), eq(aiConfigs.isActive, true))
  });

  if (!config) return false;

  let session = await db.query.aiSessions.findFirst({
    where: eq(aiSessions.chatId, chatId)
  });

  if (!session) {
    const [newSession] = await db.insert(aiSessions).values({
        teamId,
        chatId,
        history: [],
        status: 'active'
    }).returning();
    session = newSession;
  }

  if (session.status !== 'active') {
      return false;
  }

  let provider: AIProvider;
  const commonConfig = {
    apiKey: config.apiKey, 
    model: config.model,
    systemPrompt: config.systemPrompt || undefined,
    temperature: Number(config.temperature) || 0.7,
    maxOutputTokens: config.maxOutputTokens || 1000,
    attachments: config.attachments as any[] || []
  };
  
  if (config.provider === 'openai') {
    provider = new OpenAIProvider(commonConfig);
  } else if (config.provider === 'gemini') {
    provider = new GeminiProvider(commonConfig);
  } else {
    throw new Error(`Provider ${config.provider} not implemented yet`);
  }

  let finalInput = userMessage;
  if (config.provider === 'openai' && audioUrl) {
      try {
          const transcription = await provider.transcribeAudio(audioUrl);
          if (transcription) {
             finalInput = `[Audio Transcription]: ${transcription}`;
             audioUrl = null; 
          }
      } catch (e) {
          console.error("[Service] OpenAI Transcription failed", e);
      }
  }

  const history = (session.history as AIMessage[]) || [];
  
  if (history.length === 0 && config.systemPrompt && config.provider === 'openai') {
      history.push({ role: 'system', content: config.systemPrompt });
  }

  const contentPayload = finalInput || (audioUrl ? "Please listen to this audio and execute any commands requested in it." : "");

  history.push({ 
      role: 'user', 
      content: contentPayload,
      audioUrl: audioUrl 
  });

  const teamTools = await getDynamicTools(teamId);

  let keepProcessing = true;
  let finalResponseText = '';
  let loopCount = 0;
  const MAX_LOOPS = 5;
  const _aiLogBase = { teamId, chatId };
  const _aiStart = Date.now();

  logAIInteraction({ ..._aiLogBase, eventType: 'ai_request', input: { message: finalInput?.substring(0, 500) }, metadata: { model: config.model, provider: config.provider, historyLength: history.length } });

  while (keepProcessing && loopCount < MAX_LOOPS) {
      loopCount++;
      const _loopStart = Date.now();

      const response = await provider.generateResponse(history, teamTools);
      history.push(response);

      logAIInteraction({ ..._aiLogBase, eventType: 'ai_response', output: { content: response.content?.substring(0, 500), hasToolCalls: !!response.toolCalls?.length }, metadata: { model: config.model, loopCount }, durationMs: Date.now() - _loopStart });

      if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
              const toolName = toolCall.function.name;
              const tool = teamTools.find(t => t.name === toolName);

              if (tool) {
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const _toolStart = Date.now();
                    const result = await tool.execute(args, { chatId, teamId });

                    logAIInteraction({ ..._aiLogBase, eventType: 'ai_tool_call', input: { tool: toolName, args }, output: { result: JSON.stringify(result).substring(0, 500) }, durationMs: Date.now() - _toolStart });

                    if (tool.name === 'handover_to_human') {
                        await db.update(aiSessions).set({ status: 'paused' }).where(eq(aiSessions.id, session.id));
                        await pusherServer.trigger(`team-${teamId}`, 'chat-status-update', {
                            chatId, type: 'ai', status: 'paused'
                        });
                        const reason = args.reason ? `: ${args.reason}` : '';
                        await createSystemMessage(teamId, chatId, `@@syslog_ai_deactivated|reason=${reason}`);
                        logAIInteraction({ ..._aiLogBase, eventType: 'ai_handover', metadata: { reason: args.reason } });
                    }

                    history.push({
                        role: 'tool',
                        content: JSON.stringify(result),
                        toolCallId: toolCall.id || toolCall.function.name
                    });
                  } catch (toolError: any) {
                    console.error(`Tool execution error:`, toolError);
                    logAIInteraction({ ..._aiLogBase, eventType: 'ai_tool_call', input: { tool: toolName }, status: 'error', error: toolError.message });
                    history.push({
                        role: 'tool',
                        content: JSON.stringify({ error: toolError.message || "Failed to execute tool" }),
                        toolCallId: toolCall.id || toolCall.function.name
                    });
                  }
              } else {
                  history.push({
                        role: 'tool',
                        content: JSON.stringify({ error: "Tool not found" }),
                        toolCallId: toolCall.id || toolCall.function.name
                    });
              }
          }
      } else {
          finalResponseText = response.content || '';
          keepProcessing = false;
      }
  }

  const truncatedHistory = history.slice(-20);
  await db.update(aiSessions).set({ history: truncatedHistory, updatedAt: new Date() }).where(eq(aiSessions.id, session.id));

  return finalResponseText.replace(/\[SYSTEM_INSTRUCTION\]/g, '').replace(/Output EXACTLY this text: "/g, '').replace(/"$/g, '').trim();
}