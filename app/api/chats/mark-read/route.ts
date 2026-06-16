
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries'; 
import { chats } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher-server'; 

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId } = body; 

    if (!chatId || typeof chatId !== 'number') {
      return NextResponse.json({ error: 'chatId (number) is required' }, { status: 400 });
    }

    
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    
    const updatedChats = await db.update(chats)
      .set({ unreadCount: 0 })
      .where(and(
        eq(chats.id, chatId),
        eq(chats.teamId, team.id) 
      ))
      .returning({ id: chats.id, unreadCount: chats.unreadCount, remoteJid: chats.remoteJid });

    if (updatedChats.length === 0) {
      return NextResponse.json({ error: 'Chat not found or unauthorized' }, { status: 404 });
    }

    const pusherChannel = `team-${team.id}`;
    const chatListUpdateData = {
        id: updatedChats[0].id,
        unreadCount: 0, 
        remoteJid: updatedChats[0].remoteJid,
    };
    try {
        await pusherServer.trigger(pusherChannel, 'chat-list-update', chatListUpdateData);
    } catch (pusherError: any) {
        console.error(`Pusher Trigger Error for event chat-list-update (mark-read):`, pusherError.message);
        
    }


    return NextResponse.json({ success: true, chatId: chatId, unreadCount: 0 });

  } catch (error: any) {
    console.error('Error in /api/chats/mark-read:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}