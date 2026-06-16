import '../../app/globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { SWRConfig } from 'swr';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import { getBranding } from '@/lib/db/queries/branding';
import { BrandingProvider } from '@/providers/branding-provider';
import { CallProviderWrapper } from '@/providers/call-provider-wrapper';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/request';

const manrope = Manrope({ subsets: ['latin'] });

export const viewport: Viewport = {
  maximumScale: 1,
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: branding?.name || 'Whats SaaS',
    description: 'Get started quickly with a WhatsApp CRM designed to manage leads, conversations, and sales in one place.',
    icons: {
      icon: branding?.faviconUrl ? `${branding.faviconUrl}?v=${new Date(branding.updatedAt).getTime()}` : '/favicon.ico',
    },
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {

  const { locale } = await params;

  if (!locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  const branding = await getBranding();
  
  const [userData, teamData] = await Promise.all([
    getUser(),
    getTeamForUser()
  ]);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`bg-background text-foreground ${manrope.className}`}
    >
      <body className="min-h-[100dvh] bg-background">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
          >
            <SWRConfig
              value={{
                fallback: {
                  '/api/user': userData,
                  '/api/team': teamData,
                },
              }}
            >
              <BrandingProvider branding={branding}>
                <CallProviderWrapper>
                  {children}
                </CallProviderWrapper>
              </BrandingProvider>

              <Toaster
                richColors
                position="top-center"
                theme="system"
              />
            </SWRConfig>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}