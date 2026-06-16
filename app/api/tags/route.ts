
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { tags } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamTags = await db.query.tags.findMany({
      where: eq(tags.teamId, team.id),
      orderBy: (tags, { asc }) => [asc(tags.name)],
    });

    return NextResponse.json(teamTags);

  } catch (error: any) {
    console.error('Error fetching tags:', error.message);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, color } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    const [newTag] = await db.insert(tags)
      .values({
        teamId: team.id,
        name: name,
        color: color || 'gray',
      })
      .returning();

    return NextResponse.json(newTag, { status: 201 });

  } catch (error: any) {
    
    if (error.code === '23505') { 
        return NextResponse.json({ error: 'A tag with that name already exists.' }, { status: 409 });
    }
    console.error('Error creating tag:', error.message);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}