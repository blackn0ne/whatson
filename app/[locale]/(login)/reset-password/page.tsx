'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { resetPassword } from '@/app/[locale]/(login)/password-reset-actions';
import { ActionState } from '@/lib/auth/middleware';
import Logo from '@/components/interface/Logo';
import { useBranding } from '@/providers/branding-provider';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

function ResetPasswordForm() {
  const t = useTranslations('PasswordReset');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resetPassword,
    { error: '' }
  );

  const { branding } = useBranding();
  const siteName = branding?.name || 'WhatSaaS';

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-background p-4 overflow-hidden font-sans">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[120px] -z-10 rounded-full" />

      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <Link href="/sign-in">
          <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_login')}
          </Button>
        </Link>
      </div>

      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-50">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md bg-card/80 backdrop-blur-md border border-border/50 shadow-2xl rounded-2xl p-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 shadow-sm">
            <Logo showName={false} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground text-center">
            {t('reset_title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">
            {t('reset_desc')}
          </p>
        </div>

        {state?.success ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 text-sm text-center font-medium border border-green-500/20 animate-in fade-in slide-in-from-top-1">
              <CheckCircle className="h-5 w-5 mx-auto mb-2" />
              {t('reset_success')}
            </div>
            <Link href="/sign-in" className="block">
              <Button className="w-full h-11 rounded-full text-base font-medium">
                {t('go_to_login')}
              </Button>
            </Link>
          </div>
        ) : (
          <form className="space-y-5" action={formAction}>
            <input type="hidden" name="token" value={token} />

            <div className="space-y-2">
              <Label htmlFor="password">{t('new_password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={100}
                className="h-11 bg-background/50 border-border/60 focus:bg-background transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirm_password')}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={100}
                className="h-11 bg-background/50 border-border/60 focus:bg-background transition-all"
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                {state.error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 rounded-full text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  {t('resetting')}
                </>
              ) : (
                t('reset_password')
              )}
            </Button>
          </form>
        )}
      </div>

      <div className="mt-8 text-center text-xs text-muted-foreground/60">
        <p>&copy; {new Date().getFullYear()} {siteName}.</p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
