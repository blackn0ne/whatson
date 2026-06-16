import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { campaigns, campaignLeads, chats, contacts, messages } from '@/lib/db/schema';
import { eq, and, sql, lte, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const BATCH_SIZE = 50;
const DELAY_BETWEEN_SENDS_MS = 200;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date();

        await db.update(campaigns)
            .set({ status: 'PROCESSING' })
            .where(and(
                eq(campaigns.status, 'SCHEDULED'),
                lte(campaigns.scheduledAt, now)
            ));

        const activeCampaigns = await db.query.campaigns.findMany({
            where: eq(campaigns.status, 'PROCESSING'),
            with: { template: true, instance: true }
        });

        if (activeCampaigns.length === 0) {
            return NextResponse.json({ message: 'No campaigns to process' });
        }

        const results = [];

        for (const campaign of activeCampaigns) {
            if (!campaign.template || !campaign.instance) {
                await db.update(campaigns)
                    .set({ status: 'COMPLETED' })
                    .where(eq(campaigns.id, campaign.id));
                continue;
            }

            const pendingLeads = await db.query.campaignLeads.findMany({
                where: and(
                    eq(campaignLeads.campaignId, campaign.id),
                    eq(campaignLeads.status, 'PENDING')
                ),
                limit: BATCH_SIZE,
                columns: { id: true }
            });

            if (pendingLeads.length > 0) {
                await db.update(campaignLeads)
                    .set({ status: 'SENDING' })
                    .where(inArray(campaignLeads.id, pendingLeads.map(l => l.id)));
            }

            const leads = pendingLeads.length > 0
                ? await db.query.campaignLeads.findMany({
                    where: and(
                        eq(campaignLeads.campaignId, campaign.id),
                        eq(campaignLeads.status, 'SENDING')
                    ),
                    limit: BATCH_SIZE
                })
                : [];

            if (leads.length === 0) {
                await db.update(campaigns)
                    .set({ status: 'COMPLETED' })
                    .where(eq(campaigns.id, campaign.id));
                results.push({ campaignId: campaign.id, status: 'completed' });
                continue;
            }

            let sentCount = 0;
            let failedCount = 0;

            for (const lead of leads) {
                try {
                    const dbComponents = campaign.template.components as any[];
                    const payloadComponents = [];

                    for (const comp of dbComponents) {
                        if (comp.type === 'BODY') {
                            const params = [];

                            if (lead.variables) {
                                const vars = lead.variables as Record<string, string>;
                                const textMatch = comp.text.match(/\{\{(\d+)\}\}/g);
                                if (textMatch) {
                                    const expectedCount = textMatch.length;
                                    for (let i = 1; i <= expectedCount; i++) {
                                        const val = vars[i.toString()] || vars[Object.keys(vars)[i - 1]] || "";
                                        params.push({ type: 'text', text: val });
                                    }
                                }
                            }

                            if (params.length > 0) {
                                payloadComponents.push({ type: 'body', parameters: params });
                            }
                        }
                    }

                    const metaPayload = {
                        messaging_product: "whatsapp",
                        to: lead.phone,
                        type: "template",
                        template: {
                            name: campaign.template.name,
                            language: { code: campaign.template.language },
                            components: payloadComponents.length > 0 ? payloadComponents : undefined
                        }
                    };

                    const response = await fetch(
                        `https://graph.facebook.com/v21.0/${campaign.instance.metaPhoneNumberId}/messages`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${campaign.instance.metaToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(metaPayload),
                            signal: AbortSignal.timeout(10000),
                        }
                    );

                    if (response.ok) {
                        const metaResult = await response.json();
                        await db.update(campaignLeads)
                            .set({ status: 'SENT' })
                            .where(eq(campaignLeads.id, lead.id));
                        sentCount++;

                        if (campaign.createContacts) {
                            try {
                                const cleanPhone = lead.phone.replace(/[^\d]/g, '');
                                const remoteJid = `${cleanPhone}@s.whatsapp.net`;
                                const contactName = (lead.variables as Record<string, string>)?.['1'] || lead.phone;

                                let chat = await db.query.chats.findFirst({
                                    where: and(
                                        eq(chats.teamId, campaign.teamId),
                                        eq(chats.remoteJid, remoteJid),
                                        eq(chats.instanceId, campaign.instanceId)
                                    )
                                });

                                let templateText = '';
                                for (const comp of dbComponents) {
                                    if (comp.type === 'BODY' && comp.text) {
                                        templateText = comp.text;
                                        if (lead.variables) {
                                            const vars = lead.variables as Record<string, string>;
                                            templateText = templateText.replace(/\{\{(\d+)\}\}/g, (_: string, num: string) => {
                                                return vars[num] || vars[Object.keys(vars)[parseInt(num) - 1]] || `{{${num}}}`;
                                            });
                                        }
                                    }
                                }

                                const now = new Date();
                                const messageId = metaResult?.messages?.[0]?.id || `campaign_${campaign.id}_${randomUUID()}`;

                                if (!chat) {
                                    const [newChat] = await db.insert(chats).values({
                                        teamId: campaign.teamId,
                                        instanceId: campaign.instanceId,
                                        remoteJid,
                                        name: contactName,
                                        lastMessageText: templateText || `[Template: ${campaign.template.name}]`,
                                        lastMessageTimestamp: now,
                                        lastMessageFromMe: true,
                                        lastMessageStatus: 'sent',
                                        unreadCount: 0
                                    }).returning();
                                    chat = newChat;
                                } else {
                                    await db.update(chats).set({
                                        lastMessageText: templateText || `[Template: ${campaign.template.name}]`,
                                        lastMessageTimestamp: now,
                                        lastMessageFromMe: true,
                                        lastMessageStatus: 'sent'
                                    }).where(eq(chats.id, chat.id));
                                }

                                const existingContact = await db.query.contacts.findFirst({
                                    where: and(
                                        eq(contacts.teamId, campaign.teamId),
                                        eq(contacts.chatId, chat.id)
                                    )
                                });

                                if (!existingContact) {
                                    await db.insert(contacts).values({
                                        teamId: campaign.teamId,
                                        chatId: chat.id,
                                        name: contactName
                                    });
                                }

                                await db.insert(messages).values({
                                    id: messageId,
                                    chatId: chat.id,
                                    fromMe: true,
                                    messageType: 'campaign',
                                    text: templateText || `[Template: ${campaign.template.name}]`,
                                    timestamp: now,
                                    status: 'sent'
                                }).onConflictDoNothing();
                            } catch (contactErr: any) {
                                console.error('[Campaign Contact Create]', contactErr.message);
                            }
                        }
                    } else {
                        const err = await response.json();
                        await db.update(campaignLeads)
                            .set({ status: 'FAILED', error: JSON.stringify(err) })
                            .where(eq(campaignLeads.id, lead.id));
                        failedCount++;
                    }

                    await new Promise(r => setTimeout(r, DELAY_BETWEEN_SENDS_MS));

                } catch (e: any) {
                    await db.update(campaignLeads)
                        .set({ status: 'FAILED', error: e.message })
                        .where(eq(campaignLeads.id, lead.id));
                    failedCount++;
                }
            }

            await db.update(campaigns).set({
                sentCount: sql`${campaigns.sentCount} + ${sentCount}`,
                failedCount: sql`${campaigns.failedCount} + ${failedCount}`
            }).where(eq(campaigns.id, campaign.id));

            const remaining = await db.query.campaignLeads.findFirst({
                where: and(
                    eq(campaignLeads.campaignId, campaign.id),
                    sql`${campaignLeads.status} IN ('PENDING', 'SENDING')`
                )
            });

            if (!remaining) {
                await db.update(campaigns)
                    .set({ status: 'COMPLETED' })
                    .where(eq(campaigns.id, campaign.id));
            }

            results.push({
                campaignId: campaign.id,
                processed: leads.length,
                sent: sentCount,
                failed: failedCount,
                status: remaining ? 'processing' : 'completed'
            });
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('[Campaign Process]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
