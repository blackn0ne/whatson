import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getAllUsers, getAllTeamsList } from '@/lib/db/admin-queries';

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filters = {
    search: searchParams.get('search') || undefined,
    role: searchParams.get('role') || undefined,
    teamId: searchParams.get('teamId') || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    perPage: parseInt(searchParams.get('perPage') || '20'),
  };

  const [result, teams] = await Promise.all([
    getAllUsers(filters),
    getAllTeamsList(),
  ]);

  return NextResponse.json({ ...result, teams });
}
