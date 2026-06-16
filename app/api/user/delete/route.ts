import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { users, teamMembers, activityLogs, ActivityType } from '@/lib/db/schema';
import { comparePasswords } from '@/lib/auth/session';
import { eq, and, sql } from 'drizzle-orm';

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { password } = body;

  if (!password || password.length < 8) {
    return Response.json({ error: 'Password is required' }, { status: 400 });
  }

  const isPasswordValid = await comparePasswords(password, user.passwordHash);
  if (!isPasswordValid) {
    return Response.json({ error: 'Incorrect password' }, { status: 400 });
  }

  const userWithTeam = await getUserWithTeam(user.id);

  
  if (userWithTeam?.teamId) {
    await db.insert(activityLogs).values({
      teamId: userWithTeam.teamId,
      userId: user.id,
      action: ActivityType.DELETE_ACCOUNT,
    });
  }

  
  await db
    .update(users)
    .set({
      deletedAt: sql`CURRENT_TIMESTAMP`,
      email: sql`CONCAT(email, '-', id, '-deleted')`,
    })
    .where(eq(users.id, user.id));

  
  if (userWithTeam?.teamId) {
    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, user.id),
          eq(teamMembers.teamId, userWithTeam.teamId)
        )
      );
  }

  return Response.json({ success: true });
}
