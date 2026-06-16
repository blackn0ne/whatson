import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { teamPhoneNumbers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser, getUserWithTeam } from '@/lib/db/queries';

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 403 });
    }

    const numbers = await db.query.teamPhoneNumbers.findMany({
      where: eq(teamPhoneNumbers.teamId, userWithTeam.teamId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return NextResponse.json({
      numbers: numbers.map((n) => ({
        id: n.id,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        isActive: n.isActive,
        createdAt: n.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('[My Numbers GET]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
