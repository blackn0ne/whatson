
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { checkRoutePermission } from '@/lib/auth/permissions-guard';
import { ActivityType, chats, contacts, contactTags } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logActivity } from '@/lib/db/activity';
import { enforceLimit } from '@/lib/limits';

export async function POST(request: NextRequest) {
  try {
    const { error } = await checkRoutePermission('contacts');
    if (error) return error;

    const team = await getTeamForUser();
    const user = await getUser();
    if (!team || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      await enforceLimit(team.id, 'contacts');
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 403 });
    }

    const body = await request.json();
    const {
      jid,
      name,
      assignedUserId,
      funnelStageId,
      notes,
      tagIds,
      customData
    } = body;

    if (!jid || !name) {
      return NextResponse.json({ error: 'jid and name are required' }, { status: 400 });
    }

    
    const chat = await db.query.chats.findFirst({
        where: and(
            eq(chats.teamId, team.id),
            eq(chats.remoteJid, jid)
        ),
        columns: { id: true }
    });

    if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    
    let newContact: any;

    await db.transaction(async (tx) => {
        
        const [insertedContact] = await tx.insert(contacts)
            .values({
                teamId: team.id,
                chatId: chat.id,
                name: name,
                assignedUserId: assignedUserId || null,
                funnelStageId: funnelStageId || null,
                notes: notes || null,
                customData: customData || {},
                updatedAt: new Date()
            })
            .returning();
        
        newContact = insertedContact;
        await logActivity(team.id, user.id, ActivityType.CREATE_CONTACT);
        
        if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
            const tagsToInsert = tagIds.map((tagId: number) => ({
                contactId: newContact.id,
                tagId: tagId,
            }));
            await tx.insert(contactTags).values(tagsToInsert);
        }
    });

    
    const finalContact = await db.query.contacts.findFirst({
        where: eq(contacts.id, newContact.id),
        with: {
            assignedUser: { columns: { id: true, name: true, email: true } },
            funnelStage: true,
            contactTags: { with: { tag: true } }
        }
    });

    const formattedContact = {
      ...finalContact,
      tags: finalContact?.contactTags.map(ct => ct.tag) || []
    };
    delete (formattedContact as any).contactTags;

    return NextResponse.json(formattedContact, { status: 201 });

  } catch (error: any) {
     if (error.code === '23505') {
        return NextResponse.json({ error: 'This contact has already been saved' }, { status: 409 });
    }
    console.error('Error creating contact:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}