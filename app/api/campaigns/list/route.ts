import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { checkRoutePermission } from '@/lib/auth/permissions-guard';
import { campaigns } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { error } = await checkRoutePermission('campaigns');
    if (error) return NextResponse.json([]);

    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamCampaigns = await db.query.campaigns.findMany({
      where: eq(campaigns.teamId, team.id),
      orderBy: [desc(campaigns.createdAt)],
    });

    return NextResponse.json(teamCampaigns);

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}