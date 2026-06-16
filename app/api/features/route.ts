import { NextResponse, NextRequest } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { checkFeature, FeatureFlag } from '@/lib/limits';

export async function GET(request: NextRequest) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const feature = searchParams.get('name') as FeatureFlag;

    if (!feature) {
      return NextResponse.json({ error: 'Feature name is required' }, { status: 400 });
    }

    const hasAccess = await checkFeature(team.id, feature);

    return NextResponse.json({ hasAccess });

  } catch (error: any) {
    console.error('Erro ao verificar feature:', error.message);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
