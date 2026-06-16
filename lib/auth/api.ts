import { db } from '@/lib/db/drizzle';
import { apiKeys, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';
import { NextRequest } from 'next/server';

export async function getAuthenticatedTeam(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    const apiKeyData = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.key, token),
      with: { team: true }
    });

    if (apiKeyData && apiKeyData.team) {
      await db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, apiKeyData.id));
        
      return apiKeyData.team;
    }
    return null;
  }

  return await getTeamForUser();
}