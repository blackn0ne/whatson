import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { checkRoutePermission } from '@/lib/auth/permissions-guard';
import { campaigns, campaignLeads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { error } = await checkRoutePermission('campaigns');
    if (error) return error;

    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaignId } = await request.json();

    const campaign = await db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, parseInt(campaignId)), eq(campaigns.teamId, team.id)),
        with: { template: true, instance: true }
    });

    if (!campaign || !campaign.template || !campaign.instance) {
        return NextResponse.json({ error: 'Campaign invalid' }, { status: 404 });
    }

    if (campaign.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Campaign already started' }, { status: 400 });
    }

    const pendingCount = await db.query.campaignLeads.findMany({
        where: and(eq(campaignLeads.campaignId, campaign.id), eq(campaignLeads.status, 'PENDING')),
        columns: { id: true }
    });

    if (pendingCount.length === 0) {
        return NextResponse.json({ error: 'No pending leads' }, { status: 400 });
    }

    await db.update(campaigns)
        .set({ status: 'PROCESSING' })
        .where(eq(campaigns.id, campaign.id));

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;
    fetch(`${baseUrl}/api/campaigns/process`, {
      headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
    }).catch(() => {  });

    return NextResponse.json({ success: true, message: 'Campaign queued for processing' });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
