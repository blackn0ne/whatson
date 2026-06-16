import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { checkRoutePermission } from '@/lib/auth/permissions-guard';
import { wabaTemplates } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await checkRoutePermission('templates');
  if (error) return NextResponse.json([]);

  const team = await getTeamForUser();
  if (!team) return NextResponse.json([]);

  const templates = await db.query.wabaTemplates.findMany({
    where: eq(wabaTemplates.teamId, team.id),
    orderBy: [desc(wabaTemplates.updatedAt)]
  });

  return NextResponse.json(templates);
}