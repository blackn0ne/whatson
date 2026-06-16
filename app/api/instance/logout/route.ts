import { NextResponse, NextRequest } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { evolutionInstances } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const MASTER_API_KEY = process.env.AUTHENTICATION_API_KEY;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";


export async function POST(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instanceName = request.nextUrl.searchParams.get('instanceName');
    if (!instanceName) {
      return NextResponse.json({ error: 'Instance name is required' }, { status: 400 });
    }

    const dbInstance = await db.query.evolutionInstances.findFirst({
      where: and(
        eq(evolutionInstances.teamId, team.id),
        eq(evolutionInstances.instanceName, instanceName)
      ),
      columns: { accessToken: true }
    });

    if (!dbInstance) {
      return NextResponse.json({ error: 'Instance not found or unauthorized' }, { status: 404 });
    }

    const apiKeyToUse = dbInstance.accessToken || MASTER_API_KEY;
    if (!apiKeyToUse) throw new Error("API Key not configured.");

    
    const logoutResponse = await fetch(
      `${EVOLUTION_API_URL}/instance/logout/${instanceName}`,
      {
        method: 'DELETE',
        headers: { 'apikey': apiKeyToUse },
        signal: AbortSignal.timeout(10000),
      }
    );

    const data = await logoutResponse.json();

    if (!logoutResponse.ok) {
        console.error(`Failed to disconnect ${instanceName} via API:`, data);
        return NextResponse.json({ error: data.error || data.response?.message || 'Failed to disconnect from Evolution API.' }, { status: logoutResponse.status });
    }

    return NextResponse.json({ message: data.response?.message || 'Instance disconnected successfully.' });

  } catch (error: any) {
    console.error('Error in API /api/instance/logout:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}