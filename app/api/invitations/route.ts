import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { invitations } from '@/lib/db/schema';
import { getTeamForUser } from '@/lib/db/queries';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json([], { status: 401 });
    }

    const pendingInvitations = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.teamId, team.id),
          eq(invitations.status, 'pending')
        )
      );

    return NextResponse.json(pendingInvitations);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}