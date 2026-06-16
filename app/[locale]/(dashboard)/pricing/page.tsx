import { getPublishedPlans, getTeamForUser } from '@/lib/db/queries';
import { PricingClient } from './pricing-client';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const [plans, team] = await Promise.all([
    getPublishedPlans(),
    getTeamForUser(),
  ]);
  const teamData = team ? {
    planId: team.planId,
    subscriptionStatus: team.subscriptionStatus
  } : undefined;

  return <PricingClient allPlans={plans} currentTeam={teamData} />;
}