'use server';

import { db } from '@/lib/db/drizzle';
import { contacts, funnelStages, users, messages } from '@/lib/db/schema';
import { sql, eq, and, gte } from 'drizzle-orm';

export async function getDashboardStats(teamId: number) {
  const funnelMetrics = await db
    .select({
      name: funnelStages.name,
      value: sql<number>`count(${contacts.id})`.mapWith(Number),
    })
    .from(funnelStages)
    .leftJoin(contacts, eq(contacts.funnelStageId, funnelStages.id))
    .where(eq(funnelStages.teamId, teamId))
    .groupBy(funnelStages.name, funnelStages.order)
    .orderBy(funnelStages.order);

  const rawAgentMetrics = await db
    .select({
      agentName: users.name,
      funnelName: funnelStages.name,
      count: sql<number>`count(${contacts.id})`.mapWith(Number),
    })
    .from(contacts)
    .leftJoin(users, eq(contacts.assignedUserId, users.id))
    .leftJoin(funnelStages, eq(contacts.funnelStageId, funnelStages.id))
    .where(eq(contacts.teamId, teamId))
    .groupBy(users.name, funnelStages.name);

  const agentMap = new Map<string, { name: string; total: number; funnels: Record<string, number> }>();

  rawAgentMetrics.forEach((row) => {
    const name = row.agentName || 'Unassigned';
    if (!agentMap.has(name)) {
      agentMap.set(name, { name, total: 0, funnels: {} });
    }
    const agent = agentMap.get(name)!;
    agent.total += row.count;
    const fName = row.funnelName || 'No Stage';
    agent.funnels[fName] = (agent.funnels[fName] || 0) + row.count;
  });

  const agentMetrics = Array.from(agentMap.values()).sort((a, b) => b.total - a.total);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 90); 

  const rawTraffic = await db
    .select({
      day: sql<string>`to_char(${messages.timestamp}, 'YYYY-MM-DD')`,
      count: sql<number>`count(${messages.id})`.mapWith(Number),
    })
    .from(messages)
    .innerJoin(contacts, eq(messages.chatId, contacts.chatId))
    .where(
      and(
        eq(contacts.teamId, teamId),
        gte(messages.timestamp, startDate)
      )
    )
    .groupBy(sql`to_char(${messages.timestamp}, 'YYYY-MM-DD')`);

  const trafficMap = new Map(rawTraffic.map((t) => [t.day, t.count]));
  const trafficMetrics = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().split('T')[0];
    trafficMetrics.push({
      date: dayStr,
      count: trafficMap.get(dayStr) || 0,
      weekday: d.getDay(), 
    });
  }

  return {
    funnelMetrics,
    agentMetrics,
    trafficMetrics,
  };
}