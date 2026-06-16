import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { checkRoutePermission } from '@/lib/auth/permissions-guard';
import { wabaTemplates, evolutionInstances } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { error } = await checkRoutePermission('templates');
    if (error) return error;

    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { instanceId } = await request.json();

    if (!instanceId) {
        return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
    }

    const instance = await db.query.evolutionInstances.findFirst({
      where: and(
        eq(evolutionInstances.id, parseInt(instanceId)),
        eq(evolutionInstances.teamId, team.id),
        eq(evolutionInstances.integration, 'WHATSAPP-BUSINESS')
      ),
      columns: { id: true, metaToken: true, metaBusinessId: true }
    });

    if (!instance || !instance.metaToken || !instance.metaBusinessId) {
      return NextResponse.json({ error: 'Invalid WABA instance.' }, { status: 404 });
    }

    const fields = 'name,status,category,language,components,id';
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${instance.metaBusinessId}/message_templates?fields=${fields}&limit=100`,
      {
        headers: { 'Authorization': `Bearer ${instance.metaToken}` }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: 'Failed to fetch from Meta', details: errorData }, { status: response.status });
    }

    const data = await response.json();
    const templates = data.data || [];

    const upsertPromises = templates.map((tpl: any) => {
      return db.insert(wabaTemplates).values({
        teamId: team.id,
        instanceId: instance.id,
        metaId: tpl.id,
        name: tpl.name,
        language: tpl.language,
        category: tpl.category,
        status: tpl.status,
        components: tpl.components || [],
        updatedAt: new Date()
      }).onConflictDoUpdate({
        target: [wabaTemplates.instanceId, wabaTemplates.name, wabaTemplates.language],
        set: {
          metaId: tpl.id,
          category: tpl.category,
          status: tpl.status,
          components: tpl.components || [],
          updatedAt: new Date()
        }
      });
    });

    await Promise.all(upsertPromises);

    return NextResponse.json({ 
      success: true, 
      count: templates.length,
      message: `Synced ${templates.length} templates.`
    });

  } catch (error: any) {
    console.error('[Template Sync Error]', error?.message || error);
    return NextResponse.json({
      error: 'Internal server error',
      detail: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}