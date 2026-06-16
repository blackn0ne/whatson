
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { contacts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    
    const { notes } = await request.json();
    const params = await context.params;
    const contactId = parseInt(params.id, 10);

    if (isNaN(contactId)) {
      return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 });
    }

    
    const [updatedContact] = await db.update(contacts)
      .set({ 
        notes: notes, 
        updatedAt: new Date()
      })
      .where(and(
        eq(contacts.id, contactId),
        eq(contacts.teamId, team.id)
      ))
      .returning();

    if (!updatedContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json(updatedContact);

  } catch (error: any) {
    console.error('Error updating notes:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}