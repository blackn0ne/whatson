import { db } from '@/lib/db/drizzle';
import { activityLogs, NewActivityLog, ActivityType } from '@/lib/db/schema';

export async function logActivity(
  teamId: number,
  userId: number,
  action: ActivityType,
  ipAddress?: string
) {
  try {
    const newActivity: NewActivityLog = {
      teamId,
      userId,
      action,
      ipAddress: ipAddress || 'Unknown',
    };
    await db.insert(activityLogs).values(newActivity);
  } catch (error) {
    console.error(error);
  }
}