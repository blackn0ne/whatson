
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { chats, contacts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jid = request.nextUrl.searchParams.get('jid');
    if (!jid) {
      return NextResponse.json({ error: 'jid (remoteJid) is required' }, { status: 400 });
    }

    
    const chat = await db.query.chats.findFirst({
      where: and(
        eq(chats.teamId, team.id),
        eq(chats.remoteJid, jid)
      ),
      columns: { id: true }
    });

    if (!chat) {
      
      return NextResponse.json(null);
    }

    
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.chatId, chat.id),
      with: {
        assignedUser: { columns: { id: true, name: true, email: true } },
        assignedDepartment: { columns: { id: true, name: true } },
        funnelStage: true,
        contactTags: { with: { tag: true } }
      }
    });

    
    if (!contact) {
      return NextResponse.json(null);
    }

    
    const formattedContact = {
      ...contact,
      tags: contact.contactTags.map(ct => ct.tag) || []
    };
    delete (formattedContact as any).contactTags; 

    return NextResponse.json(formattedContact);

  } catch (error: any) {
    console.error('Error fetching contact:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}