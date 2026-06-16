import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { users, activityLogs, ActivityType } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const user = await getUser();
  return Response.json(user);
}

export async function PUT(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { name, email, enableSignature } = body;

  if (!name || !email) {
    return Response.json({ error: 'Name and email are required' }, { status: 400 });
  }

  const userWithTeam = await getUserWithTeam(user.id);

  await Promise.all([
    db.update(users).set({
      name,
      email,
      ...(enableSignature !== undefined ? { enableSignature: !!enableSignature } : {}),
    }).where(eq(users.id, user.id)),
    userWithTeam?.teamId
      ? db.insert(activityLogs).values({
          teamId: userWithTeam.teamId,
          userId: user.id,
          action: ActivityType.UPDATE_ACCOUNT,
        })
      : Promise.resolve(),
  ]);

  return Response.json({ success: true, name, email });
}
