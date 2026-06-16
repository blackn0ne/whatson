import React from 'react';
import { notFound, redirect } from 'next/navigation';
import FlowBuilder from '@/components/automation/FlowBuilder';
import { getAutomation } from '../actions';
import { enforceFeature } from '@/lib/limits';
import { getTeamForUser } from '@/lib/db/queries';

export default async function AutomationEditorPage({ params }: { params: { id: string } }) {
  const team = await getTeamForUser();
  if(!team) redirect('/login');
  try {
    await enforceFeature(team.id, 'isFlowBuilderEnabled');
  } catch (e) {
    return redirect('/dashboard');
  }
  
  const { id } = await params;
  const automationId = parseInt(id);
  
  if (isNaN(automationId)) return notFound();

  const automation = await getAutomation(automationId);

  if (!automation) return notFound();

  
  const initialNodes = (automation.nodes as any[])?.length > 0 
    ? (automation.nodes as any[]) 
    : [{ id: 'start-1', type: 'start', position: { x: 250, y: 100 }, data: { label: 'Start' } }];

  const initialEdges = (automation.edges as any[]) || [];

  return (
    <FlowBuilder
      automationId={automationId}
      initialNodes={initialNodes}
      initialEdges={initialEdges}
      initialActive={automation.isActive}
      integration={(automation as any).instance?.integration || 'WHATSAPP-BAILEYS'}
    />
  );
}