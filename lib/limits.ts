import { db } from '@/lib/db/drizzle';
import { plans, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { 
  getTeamMemberCount, 
  getContactCount, 
  getInstanceCount 
} from '@/lib/db/queries';

export type LimitResource = 'users' | 'contacts' | 'instances';
export type FeatureFlag = 'isAiEnabled' | 'isFlowBuilderEnabled' | 'isCampaignsEnabled' | 'isTemplatesEnabled' | 'isVoiceCallsEnabled';

export async function enforceLimit(teamId: number, resource: LimitResource) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      plan: true,
    },
  });

  if (!team || !team.plan) {
    throw new Error("Team has no active plan.");
  }

  const plan = team.plan;
  let currentUsage = 0;
  let limit = 0;
  let resourceName = '';

  switch (resource) {
    case 'users':
      currentUsage = await getTeamMemberCount(teamId);
      limit = plan.maxUsers;
      resourceName = 'Users';
      break;
    case 'contacts':
      currentUsage = await getContactCount(teamId);
      limit = plan.maxContacts;
      resourceName = 'Contacts';
      break;
    case 'instances':
      currentUsage = await getInstanceCount(teamId);
      limit = plan.maxInstances;
      resourceName = 'WhatsApp connections';
      break;
  }

  if (currentUsage >= limit) {
    throw new Error(`${resourceName} limit reached (${currentUsage}/${limit}). Please upgrade your plan.`);
  }
}

export async function checkFeature(teamId: number, feature: FeatureFlag) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      plan: true,
    },
  });

  if (!team || !team.plan) return false;

  return team.plan[feature] === true;
}

export async function enforceFeature(teamId: number, feature: FeatureFlag) {
  const hasAccess = await checkFeature(teamId, feature);
  if (!hasAccess) {
    throw new Error("Your current plan does not allow access to this feature.");
  }
}