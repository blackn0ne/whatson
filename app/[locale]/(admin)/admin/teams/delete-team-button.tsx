'use client';

import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { deleteTeam } from '../../admin-actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface DeleteTeamButtonProps {
  id: number;
}

export function DeleteTeamButton({ id }: DeleteTeamButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }

    startTransition(async () => {
      const result = await deleteTeam(id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Team deleted successfully');
        router.refresh();
      }
    });
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="text-destructive hover:bg-destructive/10"
      onClick={handleDelete}
      disabled={isPending}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}