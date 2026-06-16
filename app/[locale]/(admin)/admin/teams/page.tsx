import { getAllTeams } from '@/lib/db/admin-queries';
import { db } from '@/lib/db/drizzle';
import { plans } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DeleteTeamButton } from './delete-team-button';
import { AssignPlanSelect } from './assign-plan';

export default async function AdminTeamsPage() {
  const teams = await getAllTeams();
  const allPlans = await db.select({ id: plans.id, name: plans.name }).from(plans);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teams Management</h1>
        <Badge variant="outline">{teams.length} Teams</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>
                    <AssignPlanSelect
                      teamId={team.id}
                      currentPlanId={team.planId}
                      plans={allPlans}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={team.subscriptionStatus === 'active' ? 'default' : 'outline'}
                      className={team.subscriptionStatus === 'active' ? 'bg-green-600' : ''}
                    >
                      {team.subscriptionStatus || 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteTeamButton id={team.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}