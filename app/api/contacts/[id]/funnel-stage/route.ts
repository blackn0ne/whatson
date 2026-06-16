import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { ActivityType, contacts, funnelStages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logActivity } from '@/lib/db/activity';
import { createSystemMessage } from '@/lib/db/system-messages';
import { pusherServer } from '@/lib/pusher-server';

export async function PUT(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const team = await getTeamForUser();
    const currentUser = await getUser();
    if (!team || !currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { stageId } = await request.json();
    
    const contactId = parseInt(id, 10);
    const newStageId = stageId ? parseInt(stageId, 10) : null;

    let stageName = 'No Stage';

    if (newStageId) {
      const stage = await db.query.funnelStages.findFirst({
        where: and(
          eq(funnelStages.id, newStageId),
          eq(funnelStages.teamId, team.id)
        )
      });
      if (!stage) {
        return NextResponse.json({ error: 'Invalid Stage' }, { status: 403 });
      }
      stageName = stage.name;
    }

    const [updatedContact] = await db.update(contacts)
      .set({ 
        funnelStageId: newStageId,
        updatedAt: new Date()
      })
      .where(and(
        eq(contacts.id, contactId),
        eq(contacts.teamId, team.id)
      ))
      .returning();

    if (!updatedContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
    
    await logActivity(team.id, currentUser.id, ActivityType.CHANGE_FUNNEL_STAGE);

    if (updatedContact.chatId) {
        const logText = `@@syslog_moved_to_stage|name=${currentUser.name || currentUser.email}|stage=${stageName}`;
        await createSystemMessage(team.id, updatedContact.chatId, logText);
    }

    await pusherServer.trigger(`team-${team.id}`, 'contact-update', {
      chatId: updatedContact.chatId,
    });

    return NextResponse.json(updatedContact);
  } catch (error: any) {
    console.error('Error setting funnel stage:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}