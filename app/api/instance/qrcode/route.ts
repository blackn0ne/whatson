
import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const MASTER_API_KEY = process.env.AUTHENTICATION_API_KEY;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";

export async function GET(request: Request) {
  try {
    if (!MASTER_API_KEY) throw new Error("API Key not configured.");

    const team = await getTeamForUser();
    if (!team || !team.evolutionInstances || team.evolutionInstances.length === 0) {
      return NextResponse.json({ error: 'Instance not configured or unauthorized' }, { status: 404 });
    }

    const instanceName = team.evolutionInstances[0].instanceName;

    
    const connectResponse = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      {
        method: 'GET',
        headers: { 'apikey': MASTER_API_KEY },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!connectResponse.ok) {
        const error = await connectResponse.json();
        console.error(`Failed to fetch QR Code for ${instanceName}:`, error);
        return NextResponse.json({ error: 'Failed to fetch QR Code from API.' }, { status: 502 });
    }

    const qrData = await connectResponse.json();

    
    return NextResponse.json({ base64: qrData.qrcode?.base64 || null });

  } catch (error: any) {
    console.error('Error fetching QR Code:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}