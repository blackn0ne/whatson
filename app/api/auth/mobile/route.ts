import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, teamMembers, teams } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { comparePasswords, signToken, verifyToken } from '@/lib/auth/session';
import { getPermissions } from '@/lib/permissions';


export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const userWithTeam = await db
      .select({
        user: users,
        team: teams,
        role: teamMembers.role,
        customPermissions: teamMembers.permissions,
      })
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .leftJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (userWithTeam.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const { user: foundUser, team: foundTeam, role, customPermissions } = userWithTeam[0];

    const isPasswordValid = await comparePasswords(password, foundUser.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!foundTeam) {
      return NextResponse.json(
        { error: 'User has no team associated' },
        { status: 403 }
      );
    }

    const expiresIn30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const token = await signToken({
      user: { id: foundUser.id },
      expires: expiresIn30Days.toISOString(),
    });

    const effectiveRole = role || 'member';
    const permissions = getPermissions(effectiveRole, customPermissions);

    return NextResponse.json({
      token,
      expiresAt: expiresIn30Days.toISOString(),
      user: {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        role: effectiveRole,
      },
      team: {
        id: foundTeam.id,
        name: foundTeam.name,
      },
      permissions,
    });
  } catch (error: any) {
    console.error('[Mobile Login]', error.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token required' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const sessionData = await verifyToken(token);

    if (!sessionData?.user?.id || new Date(sessionData.expires) < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    const userWithTeam = await db
      .select({
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        team: {
          id: teams.id,
          name: teams.name,
        },
        role: teamMembers.role,
        customPermissions: teamMembers.permissions,
      })
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .leftJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
      .limit(1);

    if (userWithTeam.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { user, team, role, customPermissions: cp } = userWithTeam[0];
    const effectiveRole = role || 'member';
    const permissions = getPermissions(effectiveRole, cp);

    return NextResponse.json({
      user: { ...user, role: effectiveRole },
      team,
      permissions,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
