import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { checkRoutePermission } from '@/lib/auth/permissions-guard';
import { contacts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { error } = await checkRoutePermission('contacts');
    if (error) return NextResponse.json([]);

    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamContacts = await db.query.contacts.findMany({
      where: eq(contacts.teamId, team.id),
      orderBy: [desc(contacts.updatedAt)],
      with: {
        assignedUser: {
          columns: { id: true, name: true, email: true }
        },
        assignedDepartment: {
          columns: { id: true, name: true }
        },
        funnelStage: true,
        chat: {
            columns: { remoteJid: true, profilePicUrl: true, instanceId: true },
            with: {
              instance: {
                columns: { id: true, instanceName: true }
              }
            }
        },
        contactTags: {
          with: {
            tag: true
          }
        }
      }
    });

    const formatted = teamContacts.map(c => ({
        ...c,
        tags: c.contactTags.map(ct => ct.tag),
        profilePicUrl: c.chat?.profilePicUrl,
        phone: c.chat?.remoteJid.split('@')[0],
        instanceId: c.chat?.instance?.id || null,
        instanceName: c.chat?.instance?.instanceName || null,
    }));

    return NextResponse.json(formatted);

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}