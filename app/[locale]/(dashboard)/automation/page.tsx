import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { GitMerge, Trash2, Bot, Smartphone } from 'lucide-react';
import { getAutomations, deleteAutomation } from './actions';
import { CreateAutomationButton } from '@/components/automation/CreateAutomationButton';
import { AutomationStatusToggle } from '@/components/automation/AutomationStatusToggle';
import { SessionsSheet } from '@/components/sessions/SessionsSheet';
import { enforceFeature } from '@/lib/limits';
import { getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

export default async function AutomationListPage() {
  const t = await getTranslations('Automation');
  const team = await getTeamForUser();
  
  if(!team) redirect('/login');
  
  try {
    await enforceFeature(team.id, 'isFlowBuilderEnabled');
  } catch (e) {
    return redirect('/dashboard');
  }
  
  const automationsList = await getAutomations();

  return (
    <div className="flex flex-col h-full bg-muted p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <SessionsSheet type="automation" />
          <CreateAutomationButton />
        </div>
      </header>

      {automationsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 bg-background rounded-xl border border-border shadow-sm">
          <div className="p-4 bg-muted rounded-full mb-4">
            <GitMerge className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">{t('empty_title')}</h3>
          <p className="text-muted-foreground mb-6">{t('empty_desc')}</p>
          <CreateAutomationButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {automationsList.map((bot) => (
            <Card key={bot.id} className="flex flex-col hover:border-primary/50 transition-colors relative overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md ${bot.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                            <Bot className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-base">{bot.name}</CardTitle>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                                <Smartphone className="h-3 w-3 mr-1" />
                                {bot.instance?.instanceName || t('no_instance')}
                            </div>
                        </div>
                    </div>
                    <AutomationStatusToggle id={bot.id} initialActive={bot.isActive} />
                </div>
              </CardHeader>
              
              <CardFooter className="mt-auto flex justify-between border-t bg-muted/20 p-4">
                <Link href={`/automation/${bot.id}`}>
                  <Button variant="outline" size="sm">{t('edit_flow_btn')}</Button>
                </Link>
                
                <form action={deleteAutomation.bind(null, bot.id)}>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </form>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}