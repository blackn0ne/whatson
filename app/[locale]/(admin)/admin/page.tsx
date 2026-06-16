import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminStats, getRecentActivity } from '@/lib/db/admin-queries';
import { Users, Building2, CreditCard, Activity } from 'lucide-react';
import { PendingPayments } from './PendingPayments';

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();
  const logs = await getRecentActivity();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Admin Overview</h1>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.teams}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              System Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{log.action}</span>
                    <span className="text-xs text-muted-foreground">{log.user}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <PendingPayments />
      </div>
    </div>
  );
}