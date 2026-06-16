import { NextResponse, NextRequest } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries'; 
import { db } from '@/lib/db/drizzle'; 
import { evolutionInstances } from '@/lib/db/schema'; 
import { eq, and } from 'drizzle-orm';

const MASTER_API_KEY = process.env.AUTHENTICATION_API_KEY;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";

export async function GET(request: NextRequest) {
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

    const connectResponse = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      {
        method: 'GET',
        headers: { 'apikey': apiKeyToUse },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }
    );

    const data = await connectResponse.json();

    if (!connectResponse.ok) {
        console.error(`Failed to fetch QR Code for ${instanceName} via API:`, data);
        return NextResponse.json({ error: data.error || 'Failed to fetch QR Code from Evolution API.' }, { status: connectResponse.status });
    }

    return NextResponse.json({ base64: data.base64 || null });
  } catch (error: any) {
    console.error('Error in API /api/instance/connect:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}