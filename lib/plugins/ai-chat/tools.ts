import { ToolDefinition } from './types';
import { db } from '@/lib/db/drizzle';
import { chats, aiTools, messages, contacts, funnelStages, teamMembers, users, customFields, tags, contactTags } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher-server';
import { createSystemMessage } from '@/lib/db/system-messages';

const BASE_URL =  process.env.BASE_URL || "http://localhost:3000";
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";

async function sendMediaToEvolution(
    instance: any, 
    remoteJid: string, 
    mediaUrl: string, 
    caption: string, 
    type: 'image' | 'document' | 'audio' | 'video',
    chatId: number, 
    teamId: number
) {
    if (!instance.accessToken) return { error: 'No access token' };

    const finalMediaUrl = mediaUrl.startsWith('http') 
        ? mediaUrl 
        : `${BASE_URL}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;

    const payload = {
        number: remoteJid.replace(/\D/g, ''),
        mediatype: type,
        mimetype: type === 'image' ? 'image/jpeg' : (type === 'audio' ? 'audio/mp3' : 'application/pdf'), 
        media: finalMediaUrl, 
        caption: caption,
        fileName: "file"
    };

    try {
        const response = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instance.instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': instance.accessToken
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
        });
        
        const data = await response.json();

        if (!response.ok) {
            console.error("Evolution API Error:", data);
            throw new Error(`Evolution API failed: ${response.status}`);
        }

        if (data?.key?.id) {
            const messageId = data.key.id;
            const timestamp = new Date(); 
            
            const newMessage = {
                id: messageId, 
                chatId: chatId, 
                fromMe: true, 
                messageType: `${type}Message`, 
                text: caption || "", 
                timestamp, 
                status: 'sent' as const, 
                isInternal: false,
                isAi: true,
                mediaUrl: finalMediaUrl,
                mediaMimetype: payload.mimetype,
                mediaCaption: caption,
            };

            await db.insert(messages).values(newMessage).onConflictDoNothing();

            const pusherChannel = `team-${teamId}`;
            await pusherServer.trigger(pusherChannel, 'new-message', { 
                ...newMessage,
                timestamp: timestamp.toISOString(),
                remoteJid, 
                instance: instance.instanceName,
            });
            
            await pusherServer.trigger(pusherChannel, 'chat-list-update', {
                id: chatId,
                lastMessageText: caption || "Media sent",
                lastMessageTimestamp: timestamp.toISOString(),
                lastMessageFromMe: true,
                remoteJid
            });
        }

        return { success: true, data };
    } catch (error: any) {
        console.error("Error sending media:", error);
        return { success: false, error: error.message };
    }
}

const baseTools: ToolDefinition[] = [
  {
    name: 'handover_to_human',
    description: 'Transfers the conversation to a human agent and stops the AI.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for transfer' }
      }
    },
    execute: async (args, context) => {
       return { success: true, message: "Transferred to human" };
    }
  }
];

async function executeFunnelStageAction(
    actionData: any,
    context: { chatId: number; teamId: number }
): Promise<{ success: boolean; message: string }> {
    const { funnelStageId } = actionData;
    if (!funnelStageId) return { success: false, message: "No funnel stage configured" };

    const chat = await db.query.chats.findFirst({
        where: eq(chats.id, context.chatId),
    });
    if (!chat) return { success: false, message: "Chat not found" };

    let contact = await db.query.contacts.findFirst({
        where: and(
            eq(contacts.teamId, context.teamId),
            eq(contacts.chatId, context.chatId)
        )
    });

    if (!contact) {
        const contactName = chat.name || chat.pushName || 'New Contact';
        const [newContact] = await db.insert(contacts).values({
            teamId: context.teamId,
            chatId: context.chatId,
            name: contactName,
        }).returning();
        contact = newContact;

        await createSystemMessage(context.teamId, context.chatId, `@@syslog_contact_auto_created|name=${contactName}`);
    }

    const stage = await db.query.funnelStages.findFirst({
        where: and(
            eq(funnelStages.id, funnelStageId),
            eq(funnelStages.teamId, context.teamId)
        )
    });
    if (!stage) return { success: false, message: "Funnel stage not found" };

    await db.update(contacts)
        .set({ funnelStageId: stage.id, updatedAt: new Date() })
        .where(eq(contacts.id, contact.id));

    const logText = `@@syslog_ai_moved_to_stage|stage=${stage.name}`;
    await createSystemMessage(context.teamId, context.chatId, logText);

    await pusherServer.trigger(`team-${context.teamId}`, 'contact-update', {
        chatId: context.chatId,
        remoteJid: chat.remoteJid,
        contactId: contact.id,
        funnelStageId: stage.id,
    });

    return { success: true, message: `Contact moved to funnel stage "${stage.name}"` };
}

async function executeAssignAgentAction(
    actionData: any,
    context: { chatId: number; teamId: number }
): Promise<{ success: boolean; message: string }> {
    const { agentId } = actionData;
    if (!agentId) return { success: false, message: "No agent configured" };

    const chat = await db.query.chats.findFirst({
        where: eq(chats.id, context.chatId),
    });
    if (!chat) return { success: false, message: "Chat not found" };

    const member = await db.query.teamMembers.findFirst({
        where: and(
            eq(teamMembers.teamId, context.teamId),
            eq(teamMembers.userId, agentId)
        ),
        with: { user: { columns: { id: true, name: true, email: true } } }
    });
    if (!member) return { success: false, message: "Agent not found in team" };

    let contact = await db.query.contacts.findFirst({
        where: and(
            eq(contacts.teamId, context.teamId),
            eq(contacts.chatId, context.chatId)
        )
    });

    if (!contact) {
        const contactName = chat.name || chat.pushName || 'New Contact';
        const [newContact] = await db.insert(contacts).values({
            teamId: context.teamId,
            chatId: context.chatId,
            name: contactName,
        }).returning();
        contact = newContact;

        await createSystemMessage(context.teamId, context.chatId, `@@syslog_contact_auto_created|name=${contactName}`);
    }

    await db.update(contacts)
        .set({ assignedUserId: agentId, updatedAt: new Date() })
        .where(eq(contacts.id, contact.id));

    const agentName = member.user.name || member.user.email;
    await createSystemMessage(context.teamId, context.chatId, `@@syslog_ai_assigned_agent|agent=${agentName}`);

    await pusherServer.trigger(`team-${context.teamId}`, 'contact-update', {
        chatId: context.chatId,
        remoteJid: chat.remoteJid,
        contactId: contact.id,
        assignedUserId: agentId,
    });

    return { success: true, message: `Contact assigned to agent "${agentName}"` };
}

async function executeSetCustomFieldAction(
    actionData: any,
    args: Record<string, any>,
    context: { chatId: number; teamId: number }
): Promise<{ success: boolean; message: string }> {
    const { fieldId, fieldKey } = actionData;
    if (!fieldId || !fieldKey) return { success: false, message: "No custom field configured" };

    const value = args[fieldKey];
    if (!value) return { success: false, message: `No value provided for field "${fieldKey}"` };

    const field = await db.query.customFields.findFirst({
        where: and(
            eq(customFields.id, fieldId),
            eq(customFields.teamId, context.teamId)
        )
    });
    if (!field) return { success: false, message: "Custom field not found" };

    const chat = await db.query.chats.findFirst({
        where: eq(chats.id, context.chatId),
    });
    if (!chat) return { success: false, message: "Chat not found" };

    let contact = await db.query.contacts.findFirst({
        where: and(
            eq(contacts.teamId, context.teamId),
            eq(contacts.chatId, context.chatId)
        )
    });

    if (!contact) {
        const contactName = chat.name || chat.pushName || 'New Contact';
        const [newContact] = await db.insert(contacts).values({
            teamId: context.teamId,
            chatId: context.chatId,
            name: contactName,
        }).returning();
        contact = newContact;

        await createSystemMessage(context.teamId, context.chatId, `@@syslog_contact_auto_created|name=${contactName}`);
    }

    const currentCustomData = (contact.customData as Record<string, any>) || {};
    const updatedCustomData = { ...currentCustomData, [fieldKey]: value };

    await db.update(contacts)
        .set({ customData: updatedCustomData, updatedAt: new Date() })
        .where(eq(contacts.id, contact.id));

    await createSystemMessage(context.teamId, context.chatId, `@@syslog_ai_set_field|field=${field.name}|value=${value}`);

    await pusherServer.trigger(`team-${context.teamId}`, 'contact-update', {
        chatId: context.chatId,
        remoteJid: chat.remoteJid,
        contactId: contact.id,
        customData: updatedCustomData,
    });

    return { success: true, message: `Field "${field.name}" set to "${value}"` };
}

async function executeAddNoteAction(
    args: Record<string, any>,
    context: { chatId: number; teamId: number }
): Promise<{ success: boolean; message: string }> {
    const note = args.note;
    if (!note) return { success: false, message: "No note content provided" };

    const chat = await db.query.chats.findFirst({
        where: eq(chats.id, context.chatId),
    });
    if (!chat) return { success: false, message: "Chat not found" };

    let contact = await db.query.contacts.findFirst({
        where: and(
            eq(contacts.teamId, context.teamId),
            eq(contacts.chatId, context.chatId)
        )
    });

    if (!contact) {
        const contactName = chat.name || chat.pushName || 'New Contact';
        const [newContact] = await db.insert(contacts).values({
            teamId: context.teamId,
            chatId: context.chatId,
            name: contactName,
        }).returning();
        contact = newContact;

        await createSystemMessage(context.teamId, context.chatId, `@@syslog_contact_auto_created|name=${contactName}`);
    }

    const existingNotes = contact.notes || '';
    const timestamp = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const updatedNotes = existingNotes
        ? `${existingNotes}\n\n[AI - ${timestamp}]\n${note}`
        : `[AI - ${timestamp}]\n${note}`;

    await db.update(contacts)
        .set({ notes: updatedNotes, updatedAt: new Date() })
        .where(eq(contacts.id, contact.id));

    await createSystemMessage(context.teamId, context.chatId, `@@syslog_ai_added_note`);

    await pusherServer.trigger(`team-${context.teamId}`, 'contact-update', {
        chatId: context.chatId,
        remoteJid: chat.remoteJid,
        contactId: contact.id,
        notes: updatedNotes,
    });

    return { success: true, message: `Note added to contact` };
}

async function executeAddTagAction(
    actionData: any,
    context: { chatId: number; teamId: number }
): Promise<{ success: boolean; message: string }> {
    const { tagId } = actionData;
    if (!tagId) return { success: false, message: "No tag configured" };

    const tag = await db.query.tags.findFirst({
        where: and(eq(tags.id, tagId), eq(tags.teamId, context.teamId))
    });
    if (!tag) return { success: false, message: "Tag not found" };

    const chat = await db.query.chats.findFirst({
        where: eq(chats.id, context.chatId),
    });
    if (!chat) return { success: false, message: "Chat not found" };

    let contact = await db.query.contacts.findFirst({
        where: and(
            eq(contacts.teamId, context.teamId),
            eq(contacts.chatId, context.chatId)
        )
    });

    if (!contact) {
        const contactName = chat.name || chat.pushName || 'New Contact';
        const [newContact] = await db.insert(contacts).values({
            teamId: context.teamId,
            chatId: context.chatId,
            name: contactName,
        }).returning();
        contact = newContact;

        await createSystemMessage(context.teamId, context.chatId, `@@syslog_contact_auto_created|name=${contactName}`);
    }

    await db.insert(contactTags)
        .values({ contactId: contact.id, tagId: tag.id })
        .onConflictDoNothing();

    await createSystemMessage(context.teamId, context.chatId, `@@syslog_ai_added_tag|tag=${tag.name}`);

    await pusherServer.trigger(`team-${context.teamId}`, 'contact-update', {
        chatId: context.chatId,
        remoteJid: chat.remoteJid,
        contactId: contact.id,
    });

    return { success: true, message: `Tag "${tag.name}" added to contact` };
}

export async function getDynamicTools(teamId: number): Promise<ToolDefinition[]> {
    const dbTools = await db.query.aiTools.findMany({
        where: and(
            eq(aiTools.teamId, teamId),
            eq(aiTools.isActive, true)
        )
    });

    const dynamicTools: ToolDefinition[] = dbTools.map(t => {
        const actions: any[] = (t.actionData as any)?.actions || [];

        if (actions.length === 0) {
            const oldType = t.type || 'media';
            if (oldType === 'media' && t.mediaUrl) {
                actions.push({ type: 'media', mediaUrl: t.mediaUrl, mediaType: t.mediaType, caption: t.caption });
            } else if (oldType === 'crm_funnel_stage') {
                actions.push({ type: 'crm_funnel_stage', funnelStageId: (t.actionData as any)?.funnelStageId });
            }
        }

        const properties: Record<string, any> = {};
        for (const action of actions) {
            if (action.type === 'set_custom_field' && action.fieldKey) {
                properties[action.fieldKey] = {
                    type: 'string',
                    description: `Value for the field "${action.fieldLabel || action.fieldKey}"`,
                };
            }
            if (action.type === 'add_note') {
                properties['note'] = {
                    type: 'string',
                    description: 'Note content: summary of the conversation, key insights, and relevant details',
                };
            }
        }

        return {
            name: t.name,
            description: t.description,
            parameters: { type: 'object', properties },
            execute: async (args, context) => {
                const results: any[] = [];

                for (const action of actions) {
                    if (action.type === 'crm_funnel_stage') {
                        const result = await executeFunnelStageAction({ funnelStageId: action.funnelStageId }, context);
                        results.push(result);
                    } else if (action.type === 'assign_agent') {
                        const result = await executeAssignAgentAction({ agentId: action.agentId }, context);
                        results.push(result);
                    } else if (action.type === 'set_custom_field') {
                        const result = await executeSetCustomFieldAction(action, args, context);
                        results.push(result);
                    } else if (action.type === 'add_note') {
                        const result = await executeAddNoteAction(args, context);
                        results.push(result);
                    } else if (action.type === 'add_tag') {
                        const result = await executeAddTagAction(action, context);
                        results.push(result);
                    } else if (action.type === 'media') {
                        const chat = await db.query.chats.findFirst({
                            where: eq(chats.id, context.chatId),
                            with: { instance: true }
                        });

                        if (chat?.instance) {
                            await sendMediaToEvolution(
                                chat.instance,
                                chat.remoteJid,
                                action.mediaUrl,
                                action.caption || '',
                                action.mediaType as any,
                                context.chatId,
                                teamId
                            );
                            results.push({ success: true });
                        } else {
                            results.push({ success: false, message: "Instance not found" });
                        }
                    }
                }

                const finalMessage = t.confirmationMessage && t.confirmationMessage.trim() !== ''
                    ? `[SYSTEM_INSTRUCTION] Output EXACTLY this text to the user: "${t.confirmationMessage}"`
                    : `[SYSTEM_INSTRUCTION] Tell the user the action was executed successfully.`;

                return { success: true, results, message: finalMessage };
            }
        };
    });

    return [...baseTools, ...dynamicTools];
}