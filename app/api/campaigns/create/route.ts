import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { checkRoutePermission } from '@/lib/auth/permissions-guard';
import { campaigns, campaignLeads } from '@/lib/db/schema';

export async function POST(request: Request) {
  try {
    const { error } = await checkRoutePermission('campaigns');
    if (error) return error;

    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, instanceId, scheduledAt, templateId, leads, createContacts } = await request.json();

    const hasSchedule = scheduledAt ? true : false;
    const [newCampaign] = await db.insert(campaigns).values({
      teamId: team.id,
      instanceId: parseInt(instanceId),
      name,
      scheduledAt: hasSchedule ? new Date(scheduledAt) : null,
      templateId: templateId ? parseInt(templateId) : null,
      status: hasSchedule ? 'SCHEDULED' : 'DRAFT',
      totalLeads: leads.length,
      createContacts: createContacts || false
    }).returning();

    if (leads && leads.length > 0) {
      const leadsData = leads.map((lead: any) => ({
        campaignId: newCampaign.id,
        phone: (lead.phone || '').replace(/[^\d]/g, ''),
        variables: lead.variables || {},
        status: 'PENDING'
      }));
      
      
      await db.insert(campaignLeads).values(leadsData);
    }

    return NextResponse.json(newCampaign);

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}