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

    const { name, category, language, components, examples, instanceId } = await request.json();

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

    const formattedComponents = components.map((comp: any) => {
        const newComp = { ...comp };

        if (newComp.type === 'HEADER') {
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(newComp.format) && examples?.headerHandle) {
                newComp.example = { header_handle: [examples.headerHandle] };
            }
            if (newComp.format === 'TEXT' && newComp.text.includes('{{1}}') && examples?.headerVar) {
                newComp.example = { header_text: [examples.headerVar] };
            }
        }

        if (newComp.type === 'BODY' && examples?.bodyVars && examples.bodyVars.length > 0) {
            newComp.example = { body_text: [examples.bodyVars] };
        }

        return newComp;
    });

    const metaPayload = {
      name,
      category,
      language,
      components: formattedComponents
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${instance.metaBusinessId}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${instance.metaToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metaPayload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorObj = data.error || {};
      const userMessage = errorObj.error_user_msg;
      const userTitle = errorObj.error_user_title;
      const techMessage = errorObj.message || 'Unknown Meta error';
      
      let finalMessage = userMessage || techMessage;
      
      if (userTitle) {
          finalMessage = `${userTitle}: ${finalMessage}`;
      }

      return NextResponse.json({ 
          error: finalMessage,
          details: errorObj 
      }, { status: response.status });
    }

    const [newTemplate] = await db.insert(wabaTemplates).values({
      teamId: team.id,
      instanceId: instance.id,
      metaId: data.id,
      name,
      language,
      category,
      status: data.status || 'PENDING',
      components: formattedComponents,
    }).returning();

    return NextResponse.json(newTemplate);

  } catch (error: any) {
    console.error('Template Creation Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}