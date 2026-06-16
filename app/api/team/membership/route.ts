import { NextResponse } from 'next/server';
import { getUserMembership } from '@/lib/db/queries';
import { getPermissions } from '@/lib/permissions';

export async function GET() {
  const membership = await getUserMembership();
  if (!membership) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const permissions = getPermissions(membership.role, membership.permissions);

  return NextResponse.json({
    role: membership.role,
    permissions,
  });
}
