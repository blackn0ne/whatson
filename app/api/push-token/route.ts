import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { pushTokens } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq, and } from 'drizzle-orm';


export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { token, deviceId } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    
    await db
      .insert(pushTokens)
      .values({
        userId: user.id,
        token,
        deviceId: deviceId || null,
      })
      .onConflictDoUpdate({
        target: [pushTokens.userId, pushTokens.token],
        set: {
          deviceId: deviceId || null,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Push Token POST]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


export async function DELETE(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    await db
      .delete(pushTokens)
      .where(
        and(
          eq(pushTokens.userId, user.id),
          eq(pushTokens.token, token)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Push Token DELETE]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
