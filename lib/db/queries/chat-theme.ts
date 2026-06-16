import { db } from '@/lib/db/drizzle';

export async function getChatTheme() {
  return await db.query.chatTheme.findFirst();
}
