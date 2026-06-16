
import { db } from '@/lib/db/drizzle';

export async function getBranding() {
  return await db.query.branding.findFirst();
}
