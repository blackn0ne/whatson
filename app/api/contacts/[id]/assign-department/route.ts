import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { contacts, departments, ActivityType } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logActivity } from '@/lib/db/activity';
import { createSystemMessage } from '@/lib/db/system-messages';
import { pusherServer } from '@/lib/pusher-server';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const team = await getTeamForUser();
    const currentUser = await getUser();
    if (!team || !currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { departmentId } = await request.json();
    const { id } = await params;
    const contactId = parseInt(id, 10);

    if (isNaN(contactId)) {
      return NextResponse.json({ error: 'Invalid Contact ID' }, { status: 400 });
    }

    let deptName = '';

    if (departmentId) {
      const dept = await db.query.departments.findFirst({
        where: and(
          eq(departments.id, parseInt(departmentId)),
          eq(departments.teamId, team.id)
        ),
      });

      if (!dept) {
        return NextResponse.json({ error: 'Department not found in team' }, { status: 403 });
      }
      deptName = dept.name;
    }

    const [updatedContact] = await db.update(contacts)
      .set({
        assignedDepartmentId: departmentId ? parseInt(departmentId, 10) : null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(contacts.id, contactId),
        eq(contacts.teamId, team.id)
      ))
      .returning();

    if (!updatedContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await logActivity(team.id, currentUser.id, ActivityType.ASSIGN_DEPARTMENT);

    if (updatedContact.chatId) {
      const userName = currentUser.name || currentUser.email;
      const logText = departmentId
        ? `@@syslog_department_assigned|name=${userName}|department=${deptName}`
        : `@@syslog_department_removed|name=${userName}`;

      await createSystemMessage(team.id, updatedContact.chatId, logText);
    }

    await pusherServer.trigger(`team-${team.id}`, 'contact-update', {
      chatId: updatedContact.chatId,
    });

    return NextResponse.json(updatedContact);
  } catch (error: any) {
    console.error('Error assigning department:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
