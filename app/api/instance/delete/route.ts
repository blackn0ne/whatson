import { NextResponse, NextRequest } from 'next/server';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { ActivityType, evolutionInstances } from '@/lib/db/schema'; 
import { eq, and } from 'drizzle-orm';
import { logActivity } from '@/lib/db/activity';

const MASTER_API_KEY = process.env.AUTHENTICATION_API_KEY;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();
    const team = await getTeamForUser();
    if (!team || !user) {
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
      columns: { id: true, accessToken: true, integration: true, metaToken: true, metaWabaId: true }
    });

    if (!dbInstance) {
      return NextResponse.json({ error: 'Instance not found or unauthorized' }, { status: 404 });
    }

    
    if (dbInstance.integration === 'META-CLOUD') {
      if (dbInstance.metaWabaId && dbInstance.metaToken) {
        try {
          await fetch(
            `https://graph.facebook.com/v21.0/${dbInstance.metaWabaId}/subscribed_apps`,
            {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${dbInstance.metaToken}` },
              signal: AbortSignal.timeout(10000),
            }
          );
          console.log(`Unsubscribed webhooks for META-CLOUD instance ${instanceName}`);
        } catch (e: any) {
          console.warn(`Warning: failed to unsubscribe Meta webhook for ${instanceName}:`, e.message);
        }
      }

      await db.delete(evolutionInstances).where(eq(evolutionInstances.id, dbInstance.id));
      await logActivity(team.id, user.id, ActivityType.DELETE_INSTANCE);
      return NextResponse.json({ message: 'Instance deleted successfully.' });
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

    if (!logoutResponse.ok && logoutResponse.status !== 404) {
        const errorData = await logoutResponse.json().catch(() => ({}));
        console.warn(`Warning during logout for ${instanceName} (Status ${logoutResponse.status}):`, errorData);

    } else {
        console.log(`Logout successful or instance already disconnected for ${instanceName}.`);
    }

    console.log(`Attempting to delete instance: ${instanceName}`);
    const deleteResponse = await fetch(
      `${EVOLUTION_API_URL}/instance/delete/${instanceName}`,
      {
        method: 'DELETE',
        headers: { 'apikey': apiKeyToUse },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json().catch(() => ({}));
        if (deleteResponse.status !== 404) {
             console.error(`Error deleting ${instanceName} from Evolution API (Status ${deleteResponse.status}):`, errorData);
             return NextResponse.json({ error: errorData.error || errorData.response?.message || 'Failed to delete from Evolution API.' }, { status: deleteResponse.status });
        } else {
             console.log(`Instance ${instanceName} not found on Evolution API (404), proceeding with local removal.`);
        }
    } else {
        console.log(`Successfully deleted ${instanceName} from Evolution API.`);
        await logActivity(team.id, user.id, ActivityType.DELETE_INSTANCE);
    }

    console.log(`Deleting instance ${dbInstance.id} from local database.`);
    await db.delete(evolutionInstances)
      .where(eq(evolutionInstances.id, dbInstance.id));

    return NextResponse.json({ message: 'Instance deleted successfully.' });

  } catch (error: any) {
    console.error('Error in /api/instance/delete:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}