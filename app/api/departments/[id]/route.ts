import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { departments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deptId = parseInt(id, 10);
    const { name, description } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [updated] = await db.update(departments)
      .set({ name: name.trim(), description: description?.trim() || null })
      .where(and(eq(departments.id, deptId), eq(departments.teamId, team.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Department name already exists' }, { status: 409 });
    }
    console.error('Error updating department:', error.message);
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

    const [deleted] = await db.delete(departments)
      .where(and(eq(departments.id, deptId), eq(departments.teamId, team.id)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting department:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
