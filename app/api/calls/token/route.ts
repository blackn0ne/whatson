import { NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { generateClientToken } from '@/lib/plugins/voice-call/service';

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 403 });
    }

    const { token, identity } = await generateClientToken({
      teamId: userWithTeam.teamId,
      userId: user.id,
    });

    return NextResponse.json({ token, identity });
  } catch (error: any) {
    console.error('[Calls Token]', error.message);

    if (error.message?.includes('does not allow access')) {
      return NextResponse.json({ error: 'Feature not available on your plan' }, { status: 403 });
    }

    if (error.message?.includes('No active Twilio configuration')) {
      return NextResponse.json({ error: 'Voice calling is not configured' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
