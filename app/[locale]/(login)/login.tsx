'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import { signIn, signUp } from '@/app/[locale]/(login)/actions';
import { ActionState } from '@/lib/auth/middleware';
import Logo from '@/components/interface/Logo';
import { useBranding } from '@/providers/branding-provider'; 
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const t = useTranslations('Auth');
  
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const priceId = searchParams.get('priceId');
  const inviteId = searchParams.get('inviteId');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: '' }
  );

  const { branding } = useBranding();
  const siteName = branding?.name || 'WhatSaaS';

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-background p-4 overflow-hidden font-sans">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[120px] -z-10 rounded-full" />

      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <Link href="/">
          <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_home')}
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
            {mode === 'signin' ? t('welcome_back') : t('create_account')}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">
            {mode === 'signin' ? t('signin_desc') : t('signup_desc')}
          </p>
        </div>

        <form className="space-y-5" action={formAction}>
          <input type="hidden" name="redirect" value={redirect || ''} />
          <input type="hidden" name="priceId" value={priceId || ''} />
          <input type="hidden" name="inviteId" value={inviteId || ''} />

          <div className="space-y-2">
            <Label htmlFor="email">{t('email_label')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={50}
              className="h-11 bg-background/50 border-border/60 focus:bg-background transition-all"
              placeholder="name@example.com"
              defaultValue={state.email}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('password_label')}</Label>
              {mode === 'signin' && (
                <Link href="/forgot-password" className="text-xs text-primary hover:underline opacity-80 hover:opacity-100">
                  {t('forgot_password')}
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              maxLength={100}
              className="h-11 bg-background/50 border-border/60 focus:bg-background transition-all"
              placeholder="••••••••"
              defaultValue={state.password}
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
                {mode === 'signin' ? t('signing_in') : t('creating_account')}
              </>
            ) : mode === 'signin' ? t('sign_in') : t('sign_up')}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border/50 text-center text-sm">
          <span className="text-muted-foreground">
            {mode === 'signin' ? t('no_account') : t('has_account')}
          </span>
          <Link
            href={`${mode === 'signin' ? '/sign-up' : '/sign-in'}${
              redirect ? `?redirect=${redirect}` : ''
            }${priceId ? `&priceId=${priceId}` : ''}`}
            className="font-medium text-primary hover:underline underline-offset-4 transition-colors"
          >
            {mode === 'signin' ? t('sign_up') : t('sign_in')}
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-muted-foreground/60">
        <p>© {new Date().getFullYear()} {siteName}. {t('rights_reserved')}</p>
      </div>
    </main>
  );
}