'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function StatusBadge({ status }: { status: string }) {
    const t = useTranslations('CampaignDetails');
    if (status === 'SENT') return <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20 gap-1"><CheckCircle className="h-3 w-3" /> {t('status_sent')}</Badge>;
    if (status === 'FAILED') return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 border-destructive/20 gap-1"><XCircle className="h-3 w-3" /> {t('status_failed')}</Badge>;
    if (status === 'PENDING') return <Badge className="bg-muted text-muted-foreground hover:bg-muted border-border gap-1"><Clock className="h-3 w-3" /> {t('status_pending')}</Badge>;
    return <Badge variant="outline">{status}</Badge>;
}

export default function CampaignDetailsPage() {
    const t = useTranslations('CampaignDetails');
    const params = useParams();
    const router = useRouter();
    const campaignId = params.id as string;

    const { data: campaign, isLoading, mutate } = useSWR(campaignId ? `/api/campaigns/${campaignId}` : null, fetcher);

    React.useEffect(() => {
        if (campaign?.status !== 'PROCESSING') return;
        const interval = setInterval(() => mutate(), 5000);
        return () => clearInterval(interval);
    }, [campaign?.status, mutate]);

    if (isLoading) return <div className="flex justify-center h-screen items-center"><Loader2 className="animate-spin" /></div>;
    if (!campaign) return <div className="p-8">{t('not_found')}</div>;

    return (
        <div className="flex flex-col h-full bg-muted p-6">
            <header className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => router.push('/campaigns')}>
                    <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold text-foreground">{campaign.name}</h1>
                    <p className="text-sm text-muted-foreground">
                        {new Date(campaign.createdAt).toLocaleString()} • {campaign.instance?.instanceName}
                        {campaign.scheduledAt && ` • ${t('scheduled_for', { date: new Date(campaign.scheduledAt).toLocaleString() })}`}
                    </p>
                </div>
                <div className="ml-auto">
                    <Badge variant={campaign.status === 'COMPLETED' ? 'default' : 'outline'} className="text-sm px-3 py-1">
                        {campaign.status}
                    </Badge>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="p-4 flex flex-col items-center justify-center bg-background border-primary/20">
                    <span className="text-3xl font-bold text-primary">{campaign.totalLeads}</span>
                    <span className="text-xs text-muted-foreground uppercase font-bold mt-1">{t('stats_total')}</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center bg-background border-primary/20">
                    <span className="text-3xl font-bold text-primary">{campaign.sentCount}</span>
                    <span className="text-xs text-muted-foreground uppercase font-bold mt-1">{t('stats_success')}</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center bg-background border-destructive/20">
                    <span className="text-3xl font-bold text-destructive">{campaign.failedCount}</span>
                    <span className="text-xs text-muted-foreground uppercase font-bold mt-1">{t('stats_failed')}</span>
                </Card>
            </div>

            <div className="flex-1 bg-background rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-3">{t('table_phone')}</div>
                    <div className="col-span-2">{t('table_status')}</div>
                    <div className="col-span-7">{t('table_details')}</div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {campaign.leads.map((lead: any) => (
                        <div key={lead.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0 hover:bg-muted items-center">
                            <div className="col-span-3 font-mono text-sm text-foreground">
                                {lead.phone}
                            </div>
                            <div className="col-span-2">
                                <StatusBadge status={lead.status} />
                            </div>
                            <div className="col-span-7 text-xs font-mono break-all">
                                {lead.status === 'FAILED' ? (
                                    <span className="text-destructive bg-destructive/10 p-1 rounded block">
                                        {lead.error || t('unknown_error')}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}