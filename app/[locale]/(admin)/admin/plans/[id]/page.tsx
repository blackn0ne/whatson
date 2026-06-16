import { PlanForm } from '@/components/admin/PlanForm';
import { getPlanById } from '@/lib/db/admin-queries';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';


export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  
  const { id } = await params;
  
  
  const planId = parseInt(id);
  if (isNaN(planId)) {
    return notFound();
  }

  const plan = await getPlanById(planId);

  if (!plan) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/plans">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Edit Plan</h1>
      </div>
      <PlanForm initialData={plan} />
    </div>
  );
}