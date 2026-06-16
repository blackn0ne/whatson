import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { chats, departmentMembers } from '@/lib/db/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
import { getUserPermissionContext } from '@/lib/auth/permissions-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const permCtx = await getUserPermissionContext();
    if (!permCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope');

    const whereConditions = [eq(chats.teamId, permCtx.teamId)];

    if (scope !== 'kanban') {
      whereConditions.push(isNotNull(chats.lastMessageTimestamp));
    }

    const teamChats = await db.query.chats.findMany({
      where: and(...whereConditions),
      orderBy: [desc(chats.lastMessageTimestamp)],
      limit: scope === 'kanban' ? 500 : 50,
      with: {
        contact: {
          columns: {
            id: true,
            name: true,
            notes: true,
            showTimeInStage: true,
            assignedDepartmentId: true,
          },
          with: {
            funnelStage: {
              columns: { id: true, name: true, order: true, emoji: true }
            },
            assignedUser: {
              columns: { id: true, name: true, email: true }
            },
            assignedDepartment: {
              columns: { id: true, name: true }
            },
            contactTags: {
              with: {
                tag: {
                  columns: { id: true, name: true, color: true }
                }
              }
            }
          }
        }
      }
    });

    let filteredChats = teamChats;
    if (!permCtx.canSeeAllChats) {
      if (permCtx.chatVisibility === 'department') {
        const userDepts = await db.query.departmentMembers.findMany({
          where: eq(departmentMembers.userId, permCtx.userId),
          columns: { departmentId: true },
        });
        const deptIds = new Set(userDepts.map(d => d.departmentId));

        filteredChats = teamChats.filter((chat) => {
          if (!chat.contact) return false;
          if (chat.contact.assignedUser?.id === permCtx.userId) return true;
          if (chat.contact.assignedDepartmentId && deptIds.has(chat.contact.assignedDepartmentId)) return true;
          return false;
        });
      } else {
        filteredChats = teamChats.filter((chat) => {
          if (!chat.contact) return false;
          return chat.contact.assignedUser?.id === permCtx.userId;
        });
      }
    }

    const formattedChats = filteredChats.map((chat) => {
      const contact = chat.contact;

      if (!contact) {
        return chat;
      }

      const formattedContact = {
        ...contact,
        tags: contact.contactTags.map((ct) => ct.tag),
      };

      // @ts-ignore
      delete formattedContact.contactTags;

      return {
        ...chat,
        contact: formattedContact
      };
    });

    return NextResponse.json(formattedChats);

  } catch (error: any) {
    console.error('Error fetching chats:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
