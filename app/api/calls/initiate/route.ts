import { NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { callLogs, teamPhoneNumbers, chats } from '@/lib/db/schema';
import { eq, and, like } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 403 });
    }

    const body = await request.json();
    const { toNumber, chatId, callSid } = body;

    if (!toNumber || typeof toNumber !== 'string') {
      return NextResponse.json({ error: 'toNumber is required' }, { status: 400 });
    }

    
    const phoneNum = await db.query.teamPhoneNumbers.findFirst({
      where: and(
        eq(teamPhoneNumbers.teamId, userWithTeam.teamId),
        eq(teamPhoneNumbers.isActive, true),
      ),
    });

    const fromNumber = phoneNum?.phoneNumber || 'unknown';

    
    let resolvedChatId = chatId || null;
    if (!resolvedChatId && toNumber) {
      
      const cleanNumber = toNumber.replace(/[^\d]/g, '');
      if (cleanNumber) {
        const chat = await db.query.chats.findFirst({
          where: like(chats.remoteJid, `${cleanNumber}@%`),
          columns: { id: true },
        });
        resolvedChatId = chat?.id || null;
      }
    }

    const [log] = await db.insert(callLogs).values({
      teamId: userWithTeam.teamId,
      userId: user.id,
      chatId: resolvedChatId,
      twilioCallSid: callSid || null,
      direction: 'outbound',
      fromNumber,
      toNumber,
      status: 'initiated',
      startedAt: new Date(),
    }).returning();

    return NextResponse.json({
      callLogId: log.id,
      callSid: callSid || null,
    });
  } catch (error: any) {
    console.error('[Calls Initiate]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
