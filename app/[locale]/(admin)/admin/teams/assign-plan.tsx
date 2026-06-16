'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

type PlanOption = { id: number; name: string };

export function AssignPlanSelect({ teamId, currentPlanId, plans }: { teamId: number; currentPlanId: number | null; plans: PlanOption[] }) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = async (value: string) => {
    const planId = parseInt(value);
    if (planId === currentPlanId) return;

    setIsUpdating(true);
    try {
      const res = await fetch('/api/admin/teams/assign-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, planId }),
      });
      if (!res.ok) throw new Error();
      toast.success('Plan updated');
      window.location.reload();
    } catch {
      toast.error('Failed to update plan');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Select
      defaultValue={currentPlanId?.toString() || ''}
      onValueChange={handleChange}
      disabled={isUpdating}
    >
      <SelectTrigger className="h-8 w-[140px] text-xs">
        <SelectValue placeholder="Select plan" />
      </SelectTrigger>
      <SelectContent>
        {plans.map((plan) => (
          <SelectItem key={plan.id} value={plan.id.toString()}>
            {plan.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
