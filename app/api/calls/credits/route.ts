import { NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getCreditsBalance } from '@/lib/plugins/voice-call/service';

export const dynamic = 'force-dynamic';

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

    const balance = await getCreditsBalance(userWithTeam.teamId);

    return NextResponse.json({ balance });
  } catch (error: any) {
    console.error('[Calls Credits]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
