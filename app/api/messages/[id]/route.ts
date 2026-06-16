import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const message = await db.query.messages.findFirst({
      where: eq(messages.id, id),
      with: { chat: { columns: { teamId: true } } }
    });

    if (!message || (message as any).chat?.teamId !== team.id) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    await db.delete(messages).where(eq(messages.id, id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
