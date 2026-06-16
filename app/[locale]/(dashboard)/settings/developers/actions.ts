'use server';

import { db } from '@/lib/db/drizzle';
import { apiKeys } from '@/lib/db/schema';
import { getTeamForUser } from '@/lib/db/queries';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export async function getApiKeys() {
  const team = await getTeamForUser();
  if (!team) return [];

  return await db.query.apiKeys.findMany({
    where: eq(apiKeys.teamId, team.id),
    orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)],
  });
}

export async function createApiKey(name: string) {
  const team = await getTeamForUser();
  if (!team) throw new Error('Unauthorized');

  const prefix = 'sk_live_';
  const randomPart = crypto.randomBytes(24).toString('hex');
  const key = `${prefix}${randomPart}`;

  await db.insert(apiKeys).values({
    teamId: team.id,
    name,
    key,
  });

  revalidatePath('/settings/developers');
  return { success: true, key };
}

export async function deleteApiKey(id: number) {
  const team = await getTeamForUser();
  if (!team) throw new Error('Unauthorized');

  await db.delete(apiKeys).where(
    and(eq(apiKeys.id, id), eq(apiKeys.teamId, team.id))
  );

  revalidatePath('/settings/developers');
  return { success: true };
}