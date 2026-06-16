import { getBranding } from '@/lib/db/queries/branding';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How we handle your data.',
};

export default async function PrivacyPage() {
  const branding = await getBranding();
  const siteName = branding?.name || 'WhatSaaS';

  return (
    <main className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Information Collection</h2>
            <p>
              We collect information to provide better services to all our users. We collect information in the following ways: information you give us (such as your name, email address, and billing information) and information we get from your use of our services (such as log information, location information, and local storage).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. How We Use Information</h2>
            <p>
              We use the information we collect from all of our services to provide, maintain, protect and improve them, to develop new ones, and to protect {siteName} and our users. We also use this information to offer you tailored content – like giving you more relevant search results and ads.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Information We Share</h2>
            <p>
              We do not share personal information with companies, organizations and individuals outside of {siteName} unless one of the following circumstances applies: with your consent, for external processing (trusted businesses or persons), or for legal reasons.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Information Security</h2>
            <p>
              We work hard to protect {siteName} and our users from unauthorized access to or unauthorized alteration, disclosure or destruction of information we hold. We encrypt many of our services using SSL and review our information collection, storage and processing practices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Changes</h2>
            <p>
              Our Privacy Policy may change from time to time. We will not reduce your rights under this Privacy Policy without your explicit consent. We will post any privacy policy changes on this page and, if the changes are significant, we will provide a more prominent notice.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}