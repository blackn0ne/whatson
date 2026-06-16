import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { hasPermission, canSeeAllChats, getChatVisibility, getPermissions, type PermissionResource, type MemberPermissions, type ChatVisibility } from '@/lib/permissions';

export type PermissionContext = {
  userId: number;
  teamId: number;
  role: string;
  permissions: MemberPermissions;
  canSeeAllChats: boolean;
  chatVisibility: ChatVisibility;
};

export async function checkRoutePermission(
  resource: PermissionResource
): Promise<{ error?: NextResponse; context?: PermissionContext }> {
  const user = await getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const membership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
  });

  if (!membership) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const perms = getPermissions(membership.role, membership.permissions);

  if (!hasPermission(membership.role, membership.permissions, resource)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return {
    context: {
      userId: user.id,
      teamId: membership.teamId,
      role: membership.role,
      permissions: perms,
      canSeeAllChats: canSeeAllChats(membership.role, membership.permissions),
      chatVisibility: getChatVisibility(membership.role, membership.permissions),
    },
  };
}

export async function getUserPermissionContext(): Promise<PermissionContext | null> {
  const user = await getUser();
  if (!user) return null;

  const membership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
  });

  if (!membership) return null;

  const perms = getPermissions(membership.role, membership.permissions);

  return {
    userId: user.id,
    teamId: membership.teamId,
    role: membership.role,
    permissions: perms,
    canSeeAllChats: canSeeAllChats(membership.role, membership.permissions),
    chatVisibility: getChatVisibility(membership.role, membership.permissions),
  };
}
