import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { quickReplies } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET() {
  const team = await getTeamForUser();
  if (!team) return NextResponse.json([]);
  
  const replies = await db.query.quickReplies.findMany({
    where: eq(quickReplies.teamId, team.id),
    orderBy: [desc(quickReplies.createdAt)]
  });
  return NextResponse.json(replies);
}

export async function POST(request: NextRequest) {
  const team = await getTeamForUser();
  if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { shortcut, content } = await request.json();
  const cleanShortcut = shortcut.replace(/^\//, '').toLowerCase();

  const [newReply] = await db.insert(quickReplies).values({
    teamId: team.id,
    shortcut: cleanShortcut,
    content
  }).returning();

  return NextResponse.json(newReply);
}

export async function DELETE(request: NextRequest) {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await request.json();
    await db.delete(quickReplies).where(and(eq(quickReplies.id, id), eq(quickReplies.teamId, team.id)));
    
    return NextResponse.json({ success: true });
}