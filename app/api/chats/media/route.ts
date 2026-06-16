
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { chats, messages } from '@/lib/db/schema';
import { eq, and, desc, like, ilike, or } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const jid = searchParams.get('jid');
    const type = searchParams.get('type'); 

    if (!jid) return NextResponse.json({ error: 'JID is required' }, { status: 400 });

    
    const chat = await db.query.chats.findFirst({
      where: and(eq(chats.teamId, team.id), eq(chats.remoteJid, jid)),
      columns: { id: true }
    });

    if (!chat) return NextResponse.json([]); 

    
    let typeFilter;
    switch (type) {
      case 'images':
        typeFilter = eq(messages.messageType, 'imageMessage');
        break;
      case 'videos':
        typeFilter = eq(messages.messageType, 'videoMessage');
        break;
      case 'audio':
        
        typeFilter = or(
            eq(messages.messageType, 'audioMessage'),
            ilike(messages.mediaMimetype, 'audio/%')
        );
        break;
      case 'docs':
        typeFilter = eq(messages.messageType, 'documentMessage');
        break;
      case 'location':
        typeFilter = eq(messages.messageType, 'locationMessage');
        break;
      case 'contacts':
        typeFilter = eq(messages.messageType, 'contactMessage');
        break;
      default:
        typeFilter = eq(messages.messageType, 'imageMessage'); 
    }

    
    const mediaMessages = await db.query.messages.findMany({
      where: and(
        eq(messages.chatId, chat.id),
        typeFilter
      ),
      orderBy: [desc(messages.timestamp)],
      limit: 50, 
    });

    return NextResponse.json(mediaMessages);

  } catch (error: any) {
    console.error('Error fetching media:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}