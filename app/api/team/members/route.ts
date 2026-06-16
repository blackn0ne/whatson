import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getUser } from '@/lib/db/queries';
import { teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { TeamRole, ROLE_PRESETS, MemberPermissions } from '@/lib/permissions';

export async function PUT(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentMember = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.userId, user.id),
    });

    if (!currentMember || currentMember.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can manage roles' }, { status: 403 });
    }

    const { memberId, role, permissions } = await request.json() as {
      memberId: number;
      role: TeamRole;
      permissions?: MemberPermissions;
    };

    if (!memberId || !role) {
      return NextResponse.json({ error: 'memberId and role are required' }, { status: 400 });
    }

    if (!['owner', 'admin', 'agent'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const targetMember = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.id, memberId),
        eq(teamMembers.teamId, currentMember.teamId)
      ),
    });

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (targetMember.userId === user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    const finalPermissions = role === 'owner'
      ? null
      : (permissions || ROLE_PRESETS[role]);

    await db.update(teamMembers)
      .set({ role, permissions: finalPermissions })
      .where(eq(teamMembers.id, memberId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating member role:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
