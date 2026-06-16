import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { evolutionInstances, wabaTemplates, chats, messages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { formatMessageForFrontend } from '@/lib/db/messages';

export async function POST(request: Request) {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { recipientJid, templateId, instanceId, variables } = body;

    if (!recipientJid || !templateId || !instanceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const instance = await db.query.evolutionInstances.findFirst({
      where: and(eq(evolutionInstances.id, parseInt(instanceId)), eq(evolutionInstances.teamId, team.id)),
    });

    const template = await db.query.wabaTemplates.findFirst({
      where: and(eq(wabaTemplates.id, parseInt(templateId)), eq(wabaTemplates.teamId, team.id)),
    });

    if (!instance || !instance.metaToken || !instance.metaPhoneNumberId) {
      return NextResponse.json({ error: 'Invalid or unconnected WABA instance' }, { status: 400 });
    }
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const payloadComponents = [];
    const dbComponents = template.components as any[];

    for (const comp of dbComponents) {
      if (comp.type === 'BODY') {
        const params = [];
        
        if (variables || (comp.text && comp.text.includes('{{'))) {
            const textMatch = comp.text.match(/\{\{(\d+)\}\}/g);
            
            if (textMatch) {
                const expectedCount = textMatch.length;
                const vars = variables || {};
                
                for (let i = 1; i <= expectedCount; i++) {
                    const val = vars[i.toString()] || vars[Object.keys(vars)[i-1]] || "";
                    params.push({ type: 'text', text: val });
                }
            }
        }
        
        if (params.length > 0) {
          payloadComponents.push({
            type: 'body',
            parameters: params
          });
        }
      }
    }

    const metaPayload = {
      messaging_product: "whatsapp",
      to: recipientJid.replace('@s.whatsapp.net', '').replace(/\D/g, ''),
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        components: payloadComponents.length > 0 ? payloadComponents : undefined
      }
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${instance.metaPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${instance.metaToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metaPayload),
        signal: AbortSignal.timeout(10000),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorObj = data.error || {};
      const userMessage = errorObj.error_user_msg;
      const userTitle = errorObj.error_user_title;
      const techMessage = errorObj.message || 'Unknown Meta error';
      let finalMessage = userMessage || techMessage;
      
      if (userTitle) {
          finalMessage = `${userTitle}: ${finalMessage}`;
      }

      return NextResponse.json({ 
          error: finalMessage,
          details: errorObj 
      }, { status: response.status });
    }

    let savedMessage = null;
    
    const componentsList = (template.components as any[]);
    let previewText = componentsList.find((c: any) => c.type === 'BODY')?.text || template.name;
    if (variables) {
      previewText = previewText.replace(/\{\{(\d+)\}\}/g, (_: string, num: string) => {
        return variables[num] || variables[Object.keys(variables)[parseInt(num) - 1]] || `{{${num}}}`;
      });
    }

    await db.transaction(async (tx) => {
      let chatId;
      const existingChat = await tx.query.chats.findFirst({
        where: and(eq(chats.teamId, team.id), eq(chats.remoteJid, recipientJid)),
        columns: { id: true }
      });

      if (existingChat) {
        chatId = existingChat.id;
        await tx.update(chats).set({
          lastMessageText: previewText,
          lastMessageTimestamp: new Date(),
          lastMessageFromMe: true,
          lastMessageStatus: 'sent'
        }).where(eq(chats.id, chatId));
      } else {
        const [newChat] = await tx.insert(chats).values({
          teamId: team.id,
          remoteJid: recipientJid,
          instanceId: instance.id,
          name: recipientJid.split('@')[0],
          lastMessageText: previewText,
          lastMessageTimestamp: new Date(),
          lastMessageFromMe: true,
          unreadCount: 0,
          lastMessageStatus: 'sent'
        }).returning({ id: chats.id });
        chatId = newChat.id;
      }

      const messageId = data.messages?.[0]?.id || `waba_${Date.now()}`;

      const newMessageData = {
        id: messageId,
        chatId: chatId,
        fromMe: true,
        messageType: 'templateMessage',
        text: previewText,
        timestamp: new Date(),
        status: 'sent' as const,
        isInternal: false
      };

      const [inserted] = await tx.insert(messages).values(newMessageData).returning();
      savedMessage = inserted;
    });

    return NextResponse.json(formatMessageForFrontend(savedMessage || {}));

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}