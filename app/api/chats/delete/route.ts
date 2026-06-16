import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { chats } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function DELETE(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatIds } = await request.json();

    if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
      return NextResponse.json({ error: 'Invalid chat IDs' }, { status: 400 });
    }

    await db.delete(chats)
      .where(and(
        eq(chats.teamId, team.id),
        inArray(chats.id, chatIds)
      ));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}