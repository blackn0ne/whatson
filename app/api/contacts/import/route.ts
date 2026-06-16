import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { contacts, chats, tags, contactTags, customFields, funnelStages, teamMembers, departments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const contactList = data.contacts || [];
    const currentTeamId = data.teamId;
    const instanceId = data.instanceId || null;

    if (!currentTeamId) {
       return NextResponse.json({ error: 'Team ID required' }, { status: 400 });
    }

    const teamCustomFields = await db.query.customFields.findMany({
      where: eq(customFields.teamId, currentTeamId)
    });

    const teamStages = await db.query.funnelStages.findMany({
      where: eq(funnelStages.teamId, currentTeamId)
    });

    const teamAgents = await db.query.teamMembers.findMany({
      where: eq(teamMembers.teamId, currentTeamId),
      with: {
        user: true
      }
    });

    const teamDepartments = await db.query.departments.findMany({
      where: eq(departments.teamId, currentTeamId)
    });

    const fieldMap = new Map(teamCustomFields.map(f => [f.key, f]));
    const stageMap = new Map(teamStages.map(s => [s.name.toLowerCase().trim(), s.id]));
    const agentMap = new Map(teamAgents.map(tm => [tm.user.email.toLowerCase().trim(), tm.user.id]));
    const deptMap = new Map(teamDepartments.map(d => [d.name.toLowerCase().trim(), d.id]));

    let successCount = 0;
    let errorCount = 0;

    for (const item of contactList) {
      try {
        if (!item.phone || !item.name) {
          errorCount++;
          continue;
        }

        const cleanPhone = String(item.phone).replace(/\D/g, '');
        const remoteJid = `${cleanPhone}@s.whatsapp.net`;

        let funnelStageId = null;
        if (item.stage) {
            const stageName = String(item.stage).toLowerCase().trim();
            if (stageMap.has(stageName)) {
                funnelStageId = stageMap.get(stageName);
            }
        }

        let assignedUserId = null;
        if (item.agentEmail) {
            const email = String(item.agentEmail).toLowerCase().trim();
            if (agentMap.has(email)) {
                assignedUserId = agentMap.get(email);
            }
        }

        let assignedDepartmentId = null;
        if (item.department) {
            const deptName = String(item.department).toLowerCase().trim();
            if (deptMap.has(deptName)) {
                assignedDepartmentId = deptMap.get(deptName);
            }
        }

        let chat = await db.query.chats.findFirst({
          where: and(
            eq(chats.teamId, currentTeamId),
            eq(chats.remoteJid, remoteJid)
          )
        });

        if (!chat) {
          const [newChat] = await db.insert(chats).values({
            teamId: currentTeamId,
            remoteJid: remoteJid,
            name: item.name,
            unreadCount: 0,
            instanceId: instanceId
          }).returning();
          chat = newChat;
        }

        let contact = await db.query.contacts.findFirst({
          where: and(
            eq(contacts.teamId, currentTeamId),
            eq(contacts.chatId, chat.id)
          )
        });

        const customDataToSave: Record<string, any> = {};
        if (item.customData) {
          Object.entries(item.customData).forEach(([key, value]) => {
             if (fieldMap.has(key)) {
                const fieldDef = fieldMap.get(key);
                if (fieldDef?.type === 'boolean') {
                   const strVal = String(value).toLowerCase();
                   customDataToSave[key] = (strVal === 'true' || strVal === 'yes' || strVal === 'sim' || strVal === '1');
                } else {
                   customDataToSave[key] = String(value);
                }
             }
          });
        }

        if (contact) {
          await db.update(contacts).set({
            name: item.name,
            notes: item.notes || contact.notes,
            funnelStageId: funnelStageId || contact.funnelStageId,
            assignedUserId: assignedUserId || contact.assignedUserId,
            assignedDepartmentId: assignedDepartmentId || contact.assignedDepartmentId,
            customData: {
              ...contact.customData as object,
              ...customDataToSave
            }
          }).where(eq(contacts.id, contact.id));
        } else {
          const [newContact] = await db.insert(contacts).values({
            teamId: currentTeamId,
            chatId: chat.id,
            name: item.name,
            notes: item.notes || '',
            funnelStageId: funnelStageId,
            assignedUserId: assignedUserId,
            assignedDepartmentId: assignedDepartmentId,
            customData: customDataToSave
          }).returning();
          contact = newContact;
        }

        if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
           for (const tagName of item.tags) {
              const cleanTagName = String(tagName).trim();
              if(!cleanTagName) continue;

              let tag = await db.query.tags.findFirst({
                 where: and(
                    eq(tags.teamId, currentTeamId),
                    eq(tags.name, cleanTagName)
                 )
              });

              if (!tag) {
                 const [newTag] = await db.insert(tags).values({
                    teamId: currentTeamId,
                    name: cleanTagName,
                    color: 'gray'
                 }).returning();
                 tag = newTag;
              }

              await db.insert(contactTags).values({
                 contactId: contact.id,
                 tagId: tag.id
              }).onConflictDoNothing();
           }
        }

        successCount++;
      } catch (e) {
        console.error(e);
        errorCount++;
      }
    }

    return NextResponse.json({ success: true, imported: successCount, failed: errorCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}