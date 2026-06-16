import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { callLogs, users } from '@/lib/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { getUser, getUserWithTeam } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 403 });
    }

    const teamId = userWithTeam.teamId;

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    
    const conditions = [eq(callLogs.teamId, teamId)];
    if (chatId) {
      conditions.push(eq(callLogs.chatId, parseInt(chatId, 10)));
    }

    const whereClause = and(...conditions);

    
    const [totalResult] = await db
      .select({ count: count() })
      .from(callLogs)
      .where(whereClause);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / limit);

    
    const calls = await db
      .select({
        id: callLogs.id,
        teamId: callLogs.teamId,
        chatId: callLogs.chatId,
        userId: callLogs.userId,
        twilioCallSid: callLogs.twilioCallSid,
        direction: callLogs.direction,
        fromNumber: callLogs.fromNumber,
        toNumber: callLogs.toNumber,
        status: callLogs.status,
        duration: callLogs.duration,
        creditsUsed: callLogs.creditsUsed,
        recordingUrl: callLogs.recordingUrl,
        recordingSid: callLogs.recordingSid,
        startedAt: callLogs.startedAt,
        endedAt: callLogs.endedAt,
        createdAt: callLogs.createdAt,
        callerName: users.name,
      })
      .from(callLogs)
      .leftJoin(users, eq(callLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(callLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      calls,
      total,
      totalPages,
    });
  } catch (error: any) {
    console.error('[Calls History]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
