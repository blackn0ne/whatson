'use server';

import { db } from '@/lib/db/drizzle';
import { automations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getTeamForUser } from '@/lib/db/queries';

export async function getAutomations() {
  const team = await getTeamForUser();
  if (!team) return [];

  return await db.query.automations.findMany({
    where: eq(automations.teamId, team.id),
    orderBy: [desc(automations.updatedAt)],
    with: {
        instance: true 
    }
  });
}

export async function getAutomation(id: number) {
  const team = await getTeamForUser();
  if (!team) return null;

  const automation = await db.query.automations.findFirst({
    where: eq(automations.id, id),
    with: { instance: { columns: { integration: true } } },
  });

  if (!automation || automation.teamId !== team.id) return null;
  return automation;
}

export async function createAutomation(name: string, instanceId: number) {
  const team = await getTeamForUser();
  if (!team) throw new Error('Unauthorized');

  const [newBot] = await db.insert(automations).values({
    teamId: team.id,
    instanceId: instanceId,
    name: name,
    nodes: [],
    edges: [],
    isActive: false, 
  }).returning();

  return { success: true, id: newBot.id };
}

export async function saveAutomation(id: number, nodes: any[], edges: any[]) {
  const team = await getTeamForUser();
  if (!team) throw new Error('Unauthorized');

  await db.update(automations)
    .set({ nodes, edges, updatedAt: new Date() })
    .where(eq(automations.id, id));

  revalidatePath(`/automation/${id}`);
  return { success: true };
}

export async function toggleAutomationStatus(id: number, isActive: boolean) {
    const team = await getTeamForUser();
    if (!team) throw new Error('Unauthorized');

    await db.update(automations)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(automations.id, id));
    
    revalidatePath(`/automation/${id}`);
    revalidatePath('/automation');
    return { success: true };
}

export async function deleteAutomation(id: number) {
  const team = await getTeamForUser();
  if (!team) throw new Error('Unauthorized');

  await db.delete(automations).where(eq(automations.id, id));
  revalidatePath('/automation');
}