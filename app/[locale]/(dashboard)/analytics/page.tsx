import { getDashboardStats } from './actions';
import { TrafficHeatmap, FunnelLineChart, FunnelRadarChart, AgentList } from '@/components/dashboard/analytics-charts';
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getUserWithTeam } from '@/lib/db/queries';

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/sign-in');
  }

  const userTeamData = await getUserWithTeam(session.user.id);
  
  if (!userTeamData || !userTeamData.teamId) {
    return (
        <div className="flex-1 p-8 pt-6">
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Team not found or user not assigned to a team.</p>
            </div>
        </div>
    );
  }

  const { funnelMetrics, agentMetrics, trafficMetrics } = await getDashboardStats(userTeamData.teamId);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        
        <FunnelLineChart data={funnelMetrics} />
        <FunnelRadarChart data={funnelMetrics} />
        
        <AgentList data={agentMetrics} />
        <TrafficHeatmap data={trafficMetrics} />
        
      </div>
    </div>
  );
}