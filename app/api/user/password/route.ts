import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { users, activityLogs, ActivityType } from '@/lib/db/schema';
import { comparePasswords, hashPassword } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

export async function PUT(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return Response.json({ error: 'Current and new password are required' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return Response.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  const isPasswordValid = await comparePasswords(currentPassword, user.passwordHash);
  if (!isPasswordValid) {
    return Response.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return Response.json({ error: 'New password must be different from current password' }, { status: 400 });
  }

  const newPasswordHash = await hashPassword(newPassword);
  const userWithTeam = await getUserWithTeam(user.id);

  await Promise.all([
    db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, user.id)),
    userWithTeam?.teamId
      ? db.insert(activityLogs).values({
          teamId: userWithTeam.teamId,
          userId: user.id,
          action: ActivityType.UPDATE_PASSWORD,
        })
      : Promise.resolve(),
  ]);

  return Response.json({ success: true });
}
