'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Check, Loader2, MessageCircle, Sparkles, ArrowRight, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { checkoutAction, joinFreePlanAction, customerPortalAction } from '@/lib/payments/actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBranding } from '@/providers/branding-provider';

type Plan = {
  id: number;
  name: string;
  description: string | null;
  amount: number;
  interval: string;
  currency: string;
  stripePriceId: string;
  maxUsers: number;
  maxContacts: number;
  maxInstances: number;
  isAiEnabled: boolean;
  isFlowBuilderEnabled: boolean;
  isCampaignsEnabled: boolean;
  isTemplatesEnabled: boolean;
};


type TeamData = {
  planId: number | null;
  subscriptionStatus: string | null;
  stripeCustomerId?: string | null;
  gatewayType?: string | null;
};

export function PricingClient({ allPlans, currentTeam }: { allPlans: Plan[], currentTeam?: TeamData }) {
  const t = useTranslations('Pricing');
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const { branding } = useBranding();
  
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [selectedFreePlan, setSelectedFreePlan] = useState<Plan | null>(null);
  const [offlineModal, setOfflineModal] = useState<{ planName: string; amount: string; currency: string } | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('offline') === 'true') {
      setOfflineModal({
        planName: searchParams.get('planName') || '',
        amount: searchParams.get('amount') || '0',
        currency: searchParams.get('currency') || 'usd',
      });
    }
  }, [searchParams]);

  const featuredPlanIndex = 1;
  const filteredPlans = allPlans.filter((plan) => plan.interval === billingCycle);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const handlePlanSelection = async (plan: Plan) => {
    if (plan.amount === 0) {
      
      setSelectedFreePlan(plan);
      setIsConfirmationOpen(true);
    } else {
      
      setLoadingId(plan.id);
      const formData = new FormData();
      formData.append('planId', plan.id.toString());
      await checkoutAction(formData);
      setLoadingId(null);
    }
  };

  const confirmFreePlan = async () => {
    if (!selectedFreePlan) return;
    setLoadingId(selectedFreePlan.id);
    const formData = new FormData();
    formData.append('planId', selectedFreePlan.id.toString());
    await joinFreePlanAction(formData);
  };

  const handlePortalAccess = async () => {
    setIsPortalLoading(true);
    await customerPortalAction(new FormData());
    setIsPortalLoading(false);
  };

  return (
    <div className="min-h-full w-full bg-background dark:bg-black py-16 px-4 sm:px-6 lg:px-8 overflow-y-auto font-sans">
      <div className="max-w-7xl mx-auto text-center mb-16">
        <div className="flex items-center justify-center gap-2 mb-4">
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium tracking-wide uppercase text-primary">{branding?.name || 'WhatSaaS'}</span>
        </div>
        
        <h1 className="text-4xl font-medium text-foreground sm:text-6xl tracking-tight mb-4">
          Scale your Support
          <br />
          <span className="text-muted-foreground/80">With Powerful Automation</span>
        </h1>
        
        <p className="max-w-xl mx-auto text-lg text-muted-foreground mb-10">
          From solo entrepreneurs to large support teams. Choose the plan that fits your volume of messages and automation needs.
        </p>

        <div className="flex flex-col items-center gap-6">
            <div className="relative inline-flex bg-muted/50 dark:bg-zinc-900 border border-border p-1 rounded-full">
            <button
                onClick={() => setBillingCycle('month')}
                className={cn(
                "relative w-32 py-2 text-sm font-medium rounded-full z-10 transition-colors duration-200",
                billingCycle === 'month' ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
            >
                Monthly
            </button>
            <button
                onClick={() => setBillingCycle('year')}
                className={cn(
                "relative w-32 py-2 text-sm font-medium rounded-full z-10 transition-colors duration-200",
                billingCycle === 'year' ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
            >
                Annually
            </button>
            <div
                className={cn(
                "absolute top-1 bottom-1 left-1 w-32 bg-background dark:bg-zinc-800 rounded-full shadow-sm transition-transform duration-300 ease-in-out border border-border/50",
                billingCycle === 'year' && "translate-x-full"
                )}
            />
            </div>

            {currentTeam && currentTeam.subscriptionStatus === 'active' && currentTeam.stripeCustomerId && (
                <button
                    onClick={handlePortalAccess}
                    disabled={isPortalLoading}
                    className="text-sm text-muted-foreground underline hover:text-foreground flex items-center gap-1"
                >
                    {isPortalLoading && <Loader2 className="h-3 w-3 animate-spin"/>}
                    {t('manage_billing')}
                </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto items-start pb-40">
        {filteredPlans.map((plan, index) => {
          const isFeatured = index === featuredPlanIndex;
          const isCurrentPlan = currentTeam?.planId === plan.id;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col p-8 transition-all duration-300 h-full",
                "rounded-[2.5rem] border",
                isFeatured 
                  ? "bg-zinc-900 border-primary shadow-[0_0_40px_-10px_hsl(var(--primary)/0.3)] dark:bg-zinc-900 dark:border-primary z-10 scale-105" 
                  : "bg-background border-border hover:border-foreground/20 dark:bg-black dark:border-zinc-800",
                
              )}
            >
              <div className="mb-8">
                <div className="h-12 w-12 rounded-full border border-border/50 bg-gradient-to-br from-background to-muted flex items-center justify-center mb-6">
                  <MessageCircle className={cn("h-6 w-6", isFeatured ? "text-primary" : "text-foreground")} />
                </div>
                
                <h3 className={cn("text-2xl font-medium mb-2", isFeatured ? "text-white" : "text-foreground")}>
                  {plan.name}
                  {isCurrentPlan && <span className="ml-2 text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full border border-green-500/30">Active</span>}
                </h3>
                <p className={cn("text-sm", isFeatured ? "text-zinc-400" : "text-muted-foreground")}>
                  {plan.description || "Ideal for growing businesses."}
                </p>
              </div>

              <div className="mb-8 flex items-baseline gap-1">
                <span className={cn("text-5xl font-semibold tracking-tight", isFeatured ? "text-white" : "text-foreground")}>
                  {plan.amount === 0 ? "Free" : formatCurrency(plan.amount, plan.currency)}
                </span>
                {plan.amount > 0 && (
                  <span className={cn("text-sm", isFeatured ? "text-zinc-500" : "text-muted-foreground")}>
                    / {plan.interval === 'month' ? 'month' : 'year'}
                  </span>
                )}
              </div>

              <Button
                onClick={() => handlePlanSelection(plan)}
                disabled={loadingId === plan.id || isCurrentPlan}
                className={cn(
                  "w-full rounded-full h-12 font-medium text-sm mb-10 transition-all",
                  isFeatured
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-lg shadow-primary/20"
                    : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700",
                  isCurrentPlan && "opacity-50 cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted"
                )}
              >
                {loadingId === plan.id ? (
                    <Loader2 className="animate-spin h-4 w-4" />
                ) : isCurrentPlan ? (
                    "Current Plan"
                ) : (
                    plan.amount === 0 ? "Downgrade to Free" : "Upgrade / Switch"
                )}
              </Button>

              <div className="space-y-6 flex-1">
                <p className={cn("text-sm font-medium", isFeatured ? "text-white" : "text-foreground")}>What's included</p>
                <ul className="space-y-4">
                  <FeatureItem text={`${plan.maxUsers} Team Members`} isFeatured={isFeatured} />
                  <FeatureItem text={`${plan.maxContacts.toLocaleString()} Contacts`} isFeatured={isFeatured} />
                  <FeatureItem text={`${plan.maxInstances} WhatsApp Connections`} isFeatured={isFeatured} />
                  <FeatureItem text="AI Agent (OpenAI/Gemini)" isEnabled={plan.isAiEnabled} isFeatured={isFeatured} />
                  <FeatureItem text="Visual Flow Builder" isEnabled={plan.isFlowBuilderEnabled} isFeatured={isFeatured} />
                  <FeatureItem text="Mass Campaigns" isEnabled={plan.isCampaignsEnabled} isFeatured={isFeatured} />
                  <FeatureItem text="WABA Templates" isEnabled={plan.isTemplatesEnabled} isFeatured={isFeatured} />
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Downgrade</DialogTitle>
            <DialogDescription>
              You are switching to the <strong>{selectedFreePlan?.name}</strong> plan. Some features may be limited immediately.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
             <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Plan Limits</p>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                        <li>{selectedFreePlan?.maxUsers} User(s)</li>
                        <li>{selectedFreePlan?.maxContacts} Contacts</li>
                        <li>{selectedFreePlan?.maxInstances} WhatsApp Connection</li>
                    </ul>
                </div>
             </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmationOpen(false)}>Cancel</Button>
            <Button onClick={confirmFreePlan} disabled={loadingId !== null}>
                {loadingId === selectedFreePlan?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Confirm Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={!!offlineModal} onOpenChange={(open) => { if (!open) setOfflineModal(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              {t('offline_title')}
            </DialogTitle>
            <DialogDescription>{t('offline_desc')}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('offline_plan')}</span>
                <span className="font-medium">{offlineModal?.planName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('offline_amount')}</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('en', { style: 'currency', currency: offlineModal?.currency || 'usd' }).format(parseInt(offlineModal?.amount || '0') / 100)}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('offline_instructions')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfflineModal(null)}>{t('offline_close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureItem({ text, isEnabled = true, isFeatured }: { text: string; isEnabled?: boolean; isFeatured: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <div className={cn(
        "flex items-center justify-center h-5 w-5 rounded-full border shrink-0",
        isEnabled 
          ? (isFeatured ? "border-primary text-primary bg-primary/10" : "border-foreground text-foreground")
          : (isFeatured ? "border-zinc-700 text-zinc-700" : "border-zinc-300 text-zinc-300 dark:border-zinc-800 dark:text-zinc-800")
      )}>
        <Check className="h-3 w-3" />
      </div>
      <span className={cn(
        "text-sm", 
        isEnabled 
          ? (isFeatured ? "text-zinc-300" : "text-muted-foreground")
          : (isFeatured ? "text-zinc-700 line-through" : "text-zinc-300 dark:text-zinc-800 line-through")
      )}>
        {text}
      </span>
    </li>
  );
}