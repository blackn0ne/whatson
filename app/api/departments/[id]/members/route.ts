import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { departmentMembers, departments, teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deptId = parseInt(id, 10);
    const { userId } = await request.json();

    const dept = await db.query.departments.findFirst({
      where: and(eq(departments.id, deptId), eq(departments.teamId, team.id)),
    });
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const member = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)),
    });
    if (!member) {
      return NextResponse.json({ error: 'User is not a team member' }, { status: 400 });
    }

    const [added] = await db.insert(departmentMembers).values({
      departmentId: deptId,
      userId,
    }).returning();

    return NextResponse.json(added);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'User already in department' }, { status: 409 });
    }
    console.error('Error adding department member:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deptId = parseInt(id, 10);
    const { userId } = await request.json();

    const dept = await db.query.departments.findFirst({
      where: and(eq(departments.id, deptId), eq(departments.teamId, team.id)),
    });
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    await db.delete(departmentMembers)
      .where(and(
        eq(departmentMembers.departmentId, deptId),
        eq(departmentMembers.userId, userId)
      ));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing department member:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
