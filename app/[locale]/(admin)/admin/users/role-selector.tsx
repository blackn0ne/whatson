'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateUserRole } from '../../admin-actions';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';

interface RoleSelectorProps {
  userId: number;
  currentRole: string;
}

const roleBadgeStyles: Record<string, string> = {
  admin: 'bg-primary/10 text-primary',
  owner: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  member: 'bg-muted text-muted-foreground',
};

export function RoleSelector({ userId, currentRole }: RoleSelectorProps) {
  const [isPending, startTransition] = useTransition();
  const { mutate } = useSWRConfig();

  const handleChange = (newRole: string) => {
    if (newRole === currentRole) return;

    startTransition(async () => {
      const result = await updateUserRole(userId, newRole);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/admin/users'));
      }
    });
  };

  return (
    <Select value={currentRole} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger
        className={`w-[120px] h-8 text-xs font-medium ${roleBadgeStyles[currentRole] || ''}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="owner">Owner</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  );
}
