import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { evolutionInstances } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instances = await db.query.evolutionInstances.findMany({
      where: eq(evolutionInstances.teamId, team.id),
      columns: { id: true, instanceName: true, displayName: true }
    });

    const result = instances.map(i => ({
      id: i.id,
      instanceName: i.displayName || i.instanceName,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching instances:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
