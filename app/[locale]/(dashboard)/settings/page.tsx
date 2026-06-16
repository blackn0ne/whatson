'use client';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { customerPortalAction } from '@/lib/payments/actions';
import { useActionState, useState } from 'react';
import { TeamDataWithMembers, User, Invitation, Department } from '@/lib/db/schema';
import { removeTeamMember, inviteTeamMember, revokeInvitation, resendInvitation } from '@/app/[locale]/(login)/actions';
import useSWR from 'swr';
import { Suspense } from 'react';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  PlusCircle,
  X,
  Mail,
  Link as LinkIcon,
  Check,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CreditCard,
  Clock,
  Shield,
  Settings2,
  Building2,
  UserPlus,
  Pencil,
  Users as UsersIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeamRole, MemberPermissions, ROLE_PRESETS, getPermissions, ChatVisibility } from '@/lib/permissions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ActionState } from '@/lib/auth/middleware';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function SubscriptionSkeleton() {
  const t = useTranslations('Settings');
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>{t('subscription_title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse space-y-4 mt-1">
          <div className="h-4 w-3/4 bg-muted rounded"></div>
          <div className="h-3 w-1/2 bg-muted rounded"></div>
        </div>
      </CardContent>
    </Card>
  );
}

function ManageSubscription() {
  const t = useTranslations('Settings');
  const { data: teamData } = useSWR<TeamDataWithMembers>('/api/team', fetcher);

  const renderPlanStatus = () => {
    if (!teamData) return <span className="text-muted-foreground">{t('loading')}</span>;

    const endDate = teamData.trialEndsAt
      ? new Date(teamData.trialEndsAt).toLocaleDateString()
      : '';

    if (teamData.subscriptionStatus === 'trialing') {
        return (
            <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
                        <Clock className="w-3 h-3 mr-1" /> {t('trial_active')}
                    </Badge>
                    {teamData.isCanceled && (
                        <Badge variant="destructive" className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20">
                            {t('canceled')}
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    {teamData.isCanceled
                        ? `${t('trial_ends', { date: endDate })}`
                        : `${t('trial_ends', { date: endDate })}`}
                </p>
            </div>
        );
    }

    if (teamData.subscriptionStatus === 'active') {
        if (teamData.isCanceled) {
            return (
                <div className="flex flex-col gap-1.5 mt-2">
                    <Badge variant="secondary" className="w-fit bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20">
                        <AlertTriangle className="w-3 h-3 mr-1" /> {t('canceled')}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                        {endDate}
                    </p>
                </div>
            );
        }
        
        return (
            <div className="flex flex-col gap-1.5 mt-2">
                <Badge className="w-fit bg-green-600 hover:bg-green-700 border-transparent text-white dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30 dark:hover:bg-green-500/30">
                    <Check className="w-3 h-3 mr-1" /> {t('active')}
                </Badge>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5 mt-2">
            <Badge variant="outline" className="w-fit text-muted-foreground border-border">
                {t('free_plan')}
            </Badge>
        </div>
    );
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{t('subscription_title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <p className="font-medium text-lg">{t('current_plan')}:</p>
                <span className="text-xl font-bold text-primary">{teamData?.planName || t('free_plan_name')}</span>
              </div>
              
              {renderPlanStatus()}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Link href="/pricing" className="w-full sm:w-auto">
                    <Button variant="default" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        {teamData?.planName ? t('change_plan_btn') : t('upgrade_btn')}
                    </Button>
                </Link>

                {teamData?.stripeCustomerId && (
                    <form action={customerPortalAction} className="w-full sm:w-auto">
                        <Button type="submit" variant="outline" className="w-full">
                            <CreditCard className="mr-2 h-4 w-4" />
                            {t('billing_portal')}
                        </Button>
                    </form>
                )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamMembersSkeleton() {
  const t = useTranslations('Settings');
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>{t('members_title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse space-y-4 mt-1">
          <div className="flex items-center space-x-4">
            <div className="size-8 rounded-full bg-muted"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted rounded"></div>
              <div className="h-3 w-14 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionsDialog({
  member,
  open,
  onOpenChange,
  onSave,
}: {
  member: TeamDataWithMembers['teamMembers'][0] & { permissions?: MemberPermissions | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (memberId: number, role: TeamRole, permissions: MemberPermissions) => Promise<void>;
}) {
  const t = useTranslations('Settings');
  const currentPerms = getPermissions(member.role, member.permissions as MemberPermissions | null);
  const [role, setRole] = useState<TeamRole>(member.role as TeamRole);
  const [perms, setPerms] = useState<MemberPermissions>(currentPerms);
  const [isSaving, setIsSaving] = useState(false);

  const handleRoleChange = (newRole: string) => {
    const r = newRole as TeamRole;
    setRole(r);
    setPerms(ROLE_PRESETS[r]);
  };

  const togglePerm = (key: keyof Omit<MemberPermissions, 'chatVisibility'>) => {
    setPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(member.id, role, perms);
    setIsSaving(false);
    onOpenChange(false);
  };

  const permissionItems: { key: keyof Omit<MemberPermissions, 'chatVisibility'>; label: string }[] = [
    { key: 'automation', label: t('perm_automation') },
    { key: 'aiAgent', label: t('perm_ai_agent') },
    { key: 'contacts', label: t('perm_contacts') },
    { key: 'templates', label: t('perm_templates') },
    { key: 'campaigns', label: t('perm_campaigns') },
    { key: 'settings', label: t('perm_settings') },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('permissions_title')}
          </DialogTitle>
          <DialogDescription>
            {member.user.name || member.user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <Label className="text-sm font-medium mb-2 block">{t('role_label')}</Label>
            <Select value={role} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">{t('role_owner')}</SelectItem>
                <SelectItem value="admin">{t('role_admin')}</SelectItem>
                <SelectItem value="agent">{t('role_agent')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role !== 'owner' && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t('feature_access')}</Label>
                {permissionItems.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={perms[key]}
                      onCheckedChange={() => togglePerm(key)}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('chat_visibility')}</Label>
                <Select
                  value={perms.chatVisibility}
                  onValueChange={(v) => setPerms(prev => ({ ...prev, chatVisibility: v as ChatVisibility }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('chat_visibility_all')}</SelectItem>
                    <SelectItem value="assigned">{t('chat_visibility_assigned')}</SelectItem>
                    <SelectItem value="department">{t('chat_visibility_department')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel_btn')}</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('save_btn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROLE_BADGES: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
  admin: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  agent: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20',
  member: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20',
};

function TeamMembers() {
  const t = useTranslations('Settings');
  const { data: teamData, mutate } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const { data: currentUser } = useSWR<User>('/api/user', fetcher);
  const [memberToRemove, setMemberToRemove] = useState<number | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<number | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const isOwner = teamData?.teamMembers?.some(
    (m) => m.userId === currentUser?.id && m.role === 'owner'
  );

  const { data: invitations, mutate: mutateInvitations } = useSWR<Invitation[]>(
    isOwner ? '/api/invitations' : null, fetcher
  );

  const getUserDisplayName = (user: Pick<User, 'id' | 'name' | 'email'>) => {
    return user.name || user.email || t('unknown_user');
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);

    try {
      const formData = new FormData();
      formData.append('memberId', memberToRemove.toString());

      const result: ActionState = await removeTeamMember({}, formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t('success_update'));
        mutate();
      }
    } catch (error) {
      toast.error(t('failed_to_remove_member_toast'));
    } finally {
      setIsRemoving(false);
      setMemberToRemove(null);
    }
  };

  const handleSavePermissions = async (memberId: number, role: TeamRole, permissions: MemberPermissions) => {
    try {
      const res = await fetch('/api/team/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role, permissions }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('failed_to_update_role'));
      } else {
        toast.success(t('role_updated'));
        mutate();
      }
    } catch {
      toast.error(t('failed_to_update_role'));
    }
  };

  if (!teamData?.teamMembers?.length) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('members_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('no_members')}</p>
        </CardContent>
      </Card>
    );
  }

  const editingMember = teamData.teamMembers.find((m) => m.id === memberToEdit);

  return (
    <>
      <Card className="mb-8">
        <Tabs defaultValue="members">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('members_title')}</CardTitle>
              <TabsList className="h-8">
                <TabsTrigger value="members" className="text-xs px-3 h-7">
                  <UsersIcon className="h-3.5 w-3.5 mr-1.5" />
                  {t('tab_members')}
                </TabsTrigger>
                {isOwner && (
                  <TabsTrigger value="departments" className="text-xs px-3 h-7">
                    <Building2 className="h-3.5 w-3.5 mr-1.5" />
                    {t('tab_departments')}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
          </CardHeader>
          <CardContent>
            <TabsContent value="members" className="mt-0">
              <ul className="space-y-2">
                {teamData.teamMembers.map((member) => {
                  const isSelf = member.userId === currentUser?.id;
                  return (
                    <li key={member.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs">
                            {getUserDisplayName(member.user).split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{member.user.name || t('unknown_user')}</p>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${ROLE_BADGES[member.role] || ROLE_BADGES.member}`}>
                              {t(`role_${member.role}` as any) || member.role}
                            </Badge>
                            {isSelf && (
                              <span className="text-[10px] text-muted-foreground">({t('you')})</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isOwner && !isSelf && (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => setMemberToEdit(member.id)}
                                  >
                                    <Settings2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('manage_permissions')}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={() => setMemberToRemove(member.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('remove_member')}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
                {isOwner && invitations && invitations.length > 0 && invitations.map((invite) => (
                  <PendingInvitationItem key={`invite-${invite.id}`} invite={invite} mutate={mutateInvitations} />
                ))}
              </ul>
            </TabsContent>
            {isOwner && (
              <TabsContent value="departments" className="mt-0">
                <DepartmentsTab teamMembers={teamData.teamMembers} />
              </TabsContent>
            )}
          </CardContent>
        </Tabs>
      </Card>

      {editingMember && (
        <PermissionsDialog
          member={editingMember as any}
          open={!!memberToEdit}
          onOpenChange={(open) => !open && setMemberToEdit(null)}
          onSave={handleSavePermissions}
        />
      )}

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <AlertDialogTitle>{t('remove_dialog_title')}</AlertDialogTitle>
            </div>
            <AlertDialogDescription>{t('remove_dialog_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>{t('cancel_btn')}</AlertDialogCancel>
            <AlertDialogAction
                onClick={(e) => {
                    e.preventDefault();
                    handleRemoveMember();
                }}
                disabled={isRemoving}
                className="bg-destructive hover:bg-destructive/90"
            >
              {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('confirm_remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type DepartmentWithMembers = Department & {
  members: { id: number; userId: number; user: Pick<User, 'id' | 'name' | 'email'> }[];
};

function DepartmentsTab({ teamMembers: members }: { teamMembers: TeamDataWithMembers['teamMembers'] }) {
  const t = useTranslations('Settings');
  const { data: depts, mutate: mutateDepts } = useSWR<DepartmentWithMembers[]>('/api/departments', fetcher);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentWithMembers | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<number | null>(null);
  const [expandedDept, setExpandedDept] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateOrEdit = async (name: string, description: string, deptId?: number) => {
    try {
      const url = deptId ? `/api/departments/${deptId}` : '/api/departments';
      const method = deptId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t('department_error'));
        return;
      }
      toast.success(deptId ? t('department_updated') : t('department_created'));
      mutateDepts();
      setShowCreateDialog(false);
      setEditingDept(null);
    } catch {
      toast.error(t('department_error'));
    }
  };

  const handleDelete = async () => {
    if (!deptToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/departments/${deptToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('department_deleted'));
        mutateDepts();
      } else {
        toast.error(t('department_error'));
      }
    } catch {
      toast.error(t('department_error'));
    } finally {
      setIsDeleting(false);
      setDeptToDelete(null);
    }
  };

  const handleAddMember = async (deptId: number, userId: number) => {
    try {
      const res = await fetch(`/api/departments/${deptId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) mutateDepts();
      else toast.error(t('department_error'));
    } catch {
      toast.error(t('department_error'));
    }
  };

  const handleRemoveMember = async (deptId: number, userId: number) => {
    try {
      const res = await fetch(`/api/departments/${deptId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) mutateDepts();
      else toast.error(t('department_error'));
    } catch {
      toast.error(t('department_error'));
    }
  };

  return (
    <>
      <div className="space-y-2">
        {(!depts || depts.length === 0) && (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('no_departments')}</p>
        )}
        {depts?.map((dept) => {
          const isExpanded = expandedDept === dept.id;
          const memberIds = new Set(dept.members.map(m => m.userId));
          const availableMembers = members.filter(m => !memberIds.has(m.userId));

          return (
            <div key={dept.id} className="border rounded-lg">
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{dept.name}</p>
                    {dept.description && (
                      <p className="text-xs text-muted-foreground">{dept.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {t('department_members_count', { count: dept.members.length })}
                  </Badge>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingDept(dept); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('edit_department')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeptToDelete(dept.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('delete_department')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t px-3 py-2 space-y-1">
                  {dept.members.map((dm) => (
                    <div key={dm.id} className="flex items-center justify-between py-1.5 px-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">
                            {(dm.user.name || dm.user.email || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-medium">{dm.user.name || dm.user.email}</p>
                          {dm.user.name && <p className="text-[10px] text-muted-foreground">{dm.user.email}</p>}
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveMember(dept.id, dm.userId)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('remove_from_dept')}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}

                  {availableMembers.length > 0 ? (
                    <Select onValueChange={(v) => handleAddMember(dept.id, parseInt(v))}>
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <div className="flex items-center gap-1.5">
                          <UserPlus className="h-3.5 w-3.5" />
                          <SelectValue placeholder={t('add_member_to_dept')} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers.map((m) => (
                          <SelectItem key={m.userId} value={m.userId.toString()}>
                            {m.user.name || m.user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-[10px] text-muted-foreground text-center py-1">{t('no_available_members')}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button variant="outline" className="w-full mt-3" size="sm" onClick={() => setShowCreateDialog(true)}>
        <PlusCircle className="h-4 w-4 mr-2" />
        {t('add_department')}
      </Button>

      <DepartmentFormDialog
        open={showCreateDialog || !!editingDept}
        onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setEditingDept(null); } }}
        onSave={handleCreateOrEdit}
        department={editingDept}
      />

      <AlertDialog open={!!deptToDelete} onOpenChange={() => setDeptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle>{t('delete_department')}</AlertDialogTitle>
            </div>
            <AlertDialogDescription>{t('delete_department_confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('cancel_btn')}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('confirm_remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DepartmentFormDialog({
  open,
  onOpenChange,
  onSave,
  department,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string, deptId?: number) => Promise<void>;
  department?: DepartmentWithMembers | null;
}) {
  const t = useTranslations('Settings');
  const [name, setName] = useState(department?.name || '');
  const [description, setDescription] = useState(department?.description || '');
  const [isSaving, setIsSaving] = useState(false);

  useState(() => {
    setName(department?.name || '');
    setDescription(department?.description || '');
  });

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    await onSave(name, description, department?.id);
    setIsSaving(false);
    setName('');
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {department ? t('edit_department') : t('add_department')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2">{t('department_name')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('department_name_placeholder')}
            />
          </div>
          <div>
            <Label className="mb-2">{t('department_description')}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('department_description_placeholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel_btn')}</Button>
          <Button onClick={handleSubmit} disabled={isSaving || !name.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('save_btn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PendingInvitationItem({ invite, mutate }: { invite: Invitation, mutate: () => void }) {
    const t = useTranslations('Settings');
    const [isRevoking, setIsRevoking] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const handleCopyLink = () => {
        const link = `${window.location.origin}/sign-up?inviteId=${invite.id}`;
        navigator.clipboard.writeText(link);
        setIsCopied(true);
        toast.success(t('link_copied_toast')); 
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleResend = async () => {
        setIsResending(true);
        try {
            const formData = new FormData();
            formData.append('inviteId', invite.id.toString());
            const res: ActionState = await resendInvitation({}, formData);
            if (res.error) toast.error(res.error);
            else toast.success(t('invitation_resent_toast')); 
        } catch (e) {
            toast.error(t('failed_to_resend_toast')); 
        } finally {
            setIsResending(false);
        }
    };

    const handleRevoke = async () => {
        setIsRevoking(true);
        try {
            const formData = new FormData();
            formData.append('inviteId', invite.id.toString());
            const res: ActionState = await revokeInvitation({}, formData);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success(t('revoked_toast')); 
                mutate();
            }
        } catch (e) {
            toast.error(t('failed_to_revoke_toast')); 
        } finally {
            setIsRevoking(false);
        }
    };

    return (
        <li className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors opacity-75">
            <div className="flex items-center space-x-3">
                <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 text-xs">
                        <Mail className="h-4 w-4" />
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{invite.email}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${ROLE_BADGES[invite.role] || ROLE_BADGES.member}`}>
                            {t(`role_${invite.role}` as any) || invite.role}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0 border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400">
                            {t('pending')}
                        </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {t('invite_sent', { date: new Date(invite.invitedAt).toLocaleDateString() })}
                    </span>
                </div>
            </div>
            
            <div className="flex items-center gap-1">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleCopyLink}>
                                {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <LinkIcon className="h-4 w-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('copy_link')}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={handleResend} disabled={isResending}>
                                {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('resend_email_tooltip')}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={handleRevoke} disabled={isRevoking}>
                                {isRevoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('revoke')}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </li>
    );
}

function InviteTeamMemberSkeleton() {
  const t = useTranslations('Settings');
  return (
    <Card className="h-[260px]">
      <CardHeader>
        <CardTitle>{t('invite_section_title')}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function InviteTeamMember() {
  const t = useTranslations('Settings');
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { mutate } = useSWR('/api/invitations');
  const { data: teamData } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const isOwner = teamData?.teamMembers?.some(
    (m) => m.userId === user?.id && m.role === 'owner'
  );

  const [inviteState, inviteAction, isInvitePending] = useActionState<ActionState, FormData>(
    async (prevState, formData) => {
        const result: ActionState = await inviteTeamMember(prevState, formData);
        if (result.success) {
            toast.success(t('invitation_sent_toast')); 
            mutate();
        } else if (result.error) {
            toast.error(result.error);
        }
        return result;
    },
    {}
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('invite_section_title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={inviteAction} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-2">
              {t('email_label')}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="email@example.com"
              required
              disabled={!isOwner}
            />
          </div>
          <div>
            <Label>{t('role_label')}</Label>
            <RadioGroup
              defaultValue="agent"
              name="role"
              className="flex space-x-4"
              disabled={!isOwner}
            >
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="agent" id="agent" />
                <Label htmlFor="agent">{t('role_agent')}</Label>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="admin" id="admin" />
                <Label htmlFor="admin">{t('role_admin')}</Label>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="owner" id="owner" />
                <Label htmlFor="owner">{t('role_owner')}</Label>
              </div>
            </RadioGroup>
          </div>
          <Button
            type="submit"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isInvitePending || !isOwner}
          >
            {isInvitePending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('inviting')}
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('invite_btn')}
              </>
            )}
          </Button>
        </form>
      </CardContent>
      {!isOwner && (
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            {t('owner_only')}
          </p>
        </CardFooter>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const t = useTranslations('Settings');
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">{t('team_title')}</h1>
      <Suspense fallback={<SubscriptionSkeleton />}>
        <ManageSubscription />
      </Suspense>
      
      <Suspense fallback={<TeamMembersSkeleton />}>
        <TeamMembers />
      </Suspense>
      <Suspense fallback={<InviteTeamMemberSkeleton />}>
        <InviteTeamMember />
      </Suspense>
    </section>
  );
}