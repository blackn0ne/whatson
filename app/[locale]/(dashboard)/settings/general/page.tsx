'use client';

import { useActionState, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { updateAccount } from '@/app/[locale]/(login)/actions';
import { User } from '@/lib/db/schema';
import useSWR from 'swr';
import { Suspense } from 'react';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ActionState = {
  name?: string;
  error?: string;
  success?: string;
};

type AccountFormProps = {
  state: ActionState;
  nameValue?: string;
  emailValue?: string;
  enableSignatureValue?: boolean;
};

function AccountForm({
  state,
  nameValue = '',
  emailValue = '',
  enableSignatureValue = false,
}: AccountFormProps) {
  const t = useTranslations('Settings');
  const [signatureEnabled, setSignatureEnabled] = useState(enableSignatureValue);

  useEffect(() => {
    setSignatureEnabled(enableSignatureValue);
  }, [enableSignatureValue]);

  return (
    <>
      <div>
        <Label htmlFor="name" className="mb-2">
          {t('name_label')}
        </Label>
        <Input
          id="name"
          name="name"
          placeholder={t('name_placeholder')}
          defaultValue={state.name || nameValue}
          required
        />
      </div>
      <div>
        <Label htmlFor="email" className="mb-2">
          {t('email_label')}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t('email_placeholder')}
          defaultValue={emailValue}
          required
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="enableSignature" className="text-sm font-medium">
            {t('signature_label')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('signature_desc')}
          </p>
        </div>
        <input type="hidden" name="enableSignature" value={signatureEnabled ? 'on' : 'off'} />
        <Switch
          id="enableSignature"
          checked={signatureEnabled}
          onCheckedChange={setSignatureEnabled}
        />
      </div>
    </>
  );
}

function AccountFormWithData({ state }: { state: ActionState }) {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  return (
    <AccountForm
      state={state}
      nameValue={user?.name ?? ''}
      emailValue={user?.email ?? ''}
      enableSignatureValue={user?.enableSignature ?? false}
    />
  );
}

export default function GeneralPage() {
  const t = useTranslations('Settings');
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateAccount,
    {}
  );

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-foreground mb-6">
        {t('general_title')}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('account_info')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" action={formAction}>
            <Suspense fallback={<AccountForm state={state} />}>
              <AccountFormWithData state={state} />
            </Suspense>
            {state.error && (
              <p className="text-destructive text-sm">{state.error}</p>
            )}
            {state.success && (
              <p className="text-primary text-sm">{t('success_update')}</p>
            )}
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('save_changes')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
