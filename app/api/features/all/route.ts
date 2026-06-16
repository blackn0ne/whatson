import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { checkFeature } from '@/lib/limits';

export async function GET() {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const [isAiEnabled, isFlowBuilderEnabled, isCampaignsEnabled, isTemplatesEnabled, isVoiceCallsEnabled] = await Promise.all([
        checkFeature(team.id, 'isAiEnabled'),
        checkFeature(team.id, 'isFlowBuilderEnabled'),
        checkFeature(team.id, 'isCampaignsEnabled'),
        checkFeature(team.id, 'isTemplatesEnabled'),
        checkFeature(team.id, 'isVoiceCallsEnabled'),
    ]);

    return NextResponse.json({
        isAiEnabled,
        isFlowBuilderEnabled,
        isCampaignsEnabled,
        isTemplatesEnabled,
        isVoiceCallsEnabled,
     });

  } catch (error: any) {
    console.error('Erro ao verificar features:', error.message);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
