'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoreHorizontal, Mail, KeyRound, Trash2, Loader2 } from 'lucide-react';
import { adminSendResetLink, adminSetPassword, deleteUser } from '../../admin-actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { useTranslations } from 'next-intl';

interface UserActionsProps {
  userId: number;
  userName: string | null;
}

export function UserActions({ userId, userName }: UserActionsProps) {
  const t = useTranslations('AdminUsers');
  const [isPending, startTransition] = useTransition();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const { mutate } = useSWRConfig();
  const router = useRouter();

  const handleSendResetLink = () => {
    startTransition(async () => {
      const result = await adminSendResetLink(userId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
      }
    });
  };

  const handleSetPassword = () => {
    if (newPassword.length < 8) {
      toast.error(t('password_min_length'));
      return;
    }
    startTransition(async () => {
      const result = await adminSetPassword(userId, newPassword);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setShowPasswordDialog(false);
        setNewPassword('');
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(t('delete_confirm'))) return;
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t('delete_success'));
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/admin/users'));
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleSendResetLink}>
            <Mail className="mr-2 h-4 w-4" />
            {t('send_reset_link')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowPasswordDialog(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            {t('set_password')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('delete_user')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('set_password_title')}</DialogTitle>
            <DialogDescription>
              {t('set_password_desc', { name: userName || 'N/A' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('new_password')}</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="••••••••"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSetPassword} disabled={isPending}>
              {isPending ? (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              ) : null}
              {t('save_password')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
