import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { chats, contacts } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function PUT(req: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactIds, targetInstanceId } = await req.json();

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'contactIds is required' }, { status: 400 });
    }

    if (!targetInstanceId) {
      return NextResponse.json({ error: 'targetInstanceId is required' }, { status: 400 });
    }

    const contactList = await db.query.contacts.findMany({
      where: and(
        eq(contacts.teamId, team.id),
        inArray(contacts.id, contactIds)
      ),
      columns: { id: true, chatId: true }
    });

    if (contactList.length === 0) {
      return NextResponse.json({ error: 'No contacts found' }, { status: 404 });
    }

    const chatIds = contactList.map(c => c.chatId);

    await db.update(chats)
      .set({ instanceId: targetInstanceId })
      .where(and(
        eq(chats.teamId, team.id),
        inArray(chats.id, chatIds)
      ));

    return NextResponse.json({
      moved: contactList.length,
      message: `${contactList.length} contacts moved successfully`
    });

  } catch (error: any) {
    console.error('Error moving contacts:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
