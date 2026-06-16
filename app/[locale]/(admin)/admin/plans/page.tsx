import { getAllPlans } from '@/lib/db/admin-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Check, X } from 'lucide-react';
import Link from 'next/link';
import { DeletePlanButton } from './delete-plan-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function BooleanIcon({ value }: { value: boolean }) {
  return value ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />;
}

export default async function AdminPlansPage() {
  const plans = await getAllPlans();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plans & Features</h1>
        <Link href="/admin/plans/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Create Plan
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Instances</TableHead>
                <TableHead>AI</TableHead>
                <TableHead>Flows</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">
                    {plan.name}
                    <div className="text-xs text-muted-foreground">{plan.stripeProductId || 'Custom'}</div>
                  </TableCell>
                  <TableCell>{plan.maxUsers}</TableCell>
                  <TableCell>{plan.maxInstances}</TableCell>
                  <TableCell><BooleanIcon value={plan.isAiEnabled} /></TableCell>
                  <TableCell><BooleanIcon value={plan.isFlowBuilderEnabled} /></TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    <Link href={`/admin/plans/${plan.id}`}>
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <DeletePlanButton id={plan.id} />
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