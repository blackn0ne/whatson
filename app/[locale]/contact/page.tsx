'use client';

import Link from 'next/link';
import { ArrowLeft, Mail, MapPin, MessageSquare, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useActionState } from 'react';
import { sendContactMessage } from './actions';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useBranding } from '@/providers/branding-provider';

export default function ContactPage() {
  const { branding } = useBranding();
  const siteName = branding?.name || 'WhatSaaS';

  const [state, formAction, isPending] = useActionState(sendContactMessage, {});

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <main className="min-h-screen bg-background">
      <div className="w-full h-full lg:grid lg:grid-cols-2">
        
        <div className="relative flex flex-col justify-center p-8 md:p-12 lg:p-20 bg-muted/30 border-r border-border min-h-[50vh] lg:min-h-screen">
          <Link href="/">
            <Button variant="ghost" className="absolute top-6 left-6 pl-0 hover:bg-transparent hover:text-primary">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>

          <div className="max-w-md mx-auto lg:mx-0 mt-10 lg:mt-0">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Get in touch
            </h1>
            <p className="text-lg text-muted-foreground mb-12">
              Have questions about plans, integrations, or enterprise features? 
              Our team is ready to help you scale your business.
            </p>

            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 shadow-sm">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Email</h3>
                  <p className="text-sm text-muted-foreground mt-1">support@{siteName.toLowerCase().replace(/\s+/g, '')}.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 shadow-sm">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Live Chat</h3>
                  <p className="text-sm text-muted-foreground mt-1">Available Mon-Fri, 9am - 6pm EST.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 shadow-sm">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Office</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    456 University Ave.<br />
                    Palo Alto, CA 94301
                    </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-8 md:p-12 lg:p-20 bg-background">
          <Card className="w-full max-w-lg border-none shadow-none lg:border lg:shadow-sm">
            <CardContent className="p-0 lg:p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold">Send us a message</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Fill out the form below and we'll get back to you as soon as possible.
                </p>
              </div>

              <form action={formAction} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" name="firstName" placeholder="John" required disabled={isPending} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" name="lastName" placeholder="Doe" required disabled={isPending} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" name="email" type="email" placeholder="john@example.com" required disabled={isPending} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" name="subject" placeholder="How can we help?" required disabled={isPending} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea 
                    id="message"
                    name="message" 
                    placeholder="Tell us more about your inquiry..." 
                    className="min-h-[150px] resize-none"
                    required
                    disabled={isPending}
                  />
                </div>

                <Button type="submit" className="w-full h-11" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Send Message
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

      </div>
    </main>
  );
}