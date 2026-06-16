import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { departments, departmentMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTeamForUser, getUser } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamDepartments = await db.query.departments.findMany({
      where: eq(departments.teamId, team.id),
      with: {
        members: {
          with: {
            user: { columns: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json(teamDepartments);
  } catch (error: any) {
    console.error('Error fetching departments:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const team = await getTeamForUser();
    const user = await getUser();
    if (!team || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [department] = await db.insert(departments).values({
      teamId: team.id,
      name: name.trim(),
      description: description?.trim() || null,
    }).returning();

    return NextResponse.json(department);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Department name already exists' }, { status: 409 });
    }
    console.error('Error creating department:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
