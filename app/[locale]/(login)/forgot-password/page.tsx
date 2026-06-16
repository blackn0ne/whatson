'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import { requestPasswordReset } from '@/app/[locale]/(login)/password-reset-actions';
import { ActionState } from '@/lib/auth/middleware';
import Logo from '@/components/interface/Logo';
import { useBranding } from '@/providers/branding-provider';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function ForgotPasswordPage() {
  const t = useTranslations('PasswordReset');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestPasswordReset,
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
            {t('forgot_title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">
            {t('forgot_desc')}
          </p>
        </div>

        {state?.success ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 text-sm text-center font-medium border border-green-500/20 animate-in fade-in slide-in-from-top-1">
              <Mail className="h-5 w-5 mx-auto mb-2" />
              {t('email_sent')}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {t('check_spam')}
            </p>
          </div>
        ) : (
          <form className="space-y-5" action={formAction}>
            <div className="space-y-2">
              <Label htmlFor="email">{t('email_label')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={255}
                className="h-11 bg-background/50 border-border/60 focus:bg-background transition-all"
                placeholder="name@example.com"
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
                  {t('sending')}
                </>
              ) : (
                t('send_reset_link')
              )}
            </Button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-border/50 text-center text-sm">
          <span className="text-muted-foreground">{t('remember_password')} </span>
          <Link
            href="/sign-in"
            className="font-medium text-primary hover:underline underline-offset-4 transition-colors"
          >
            {t('sign_in')}
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-muted-foreground/60">
        <p>&copy; {new Date().getFullYear()} {siteName}.</p>
      </div>
    </main>
  );
}
