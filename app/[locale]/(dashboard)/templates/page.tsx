'use client';

import React, { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import {
    LayoutTemplate, RefreshCw, Plus, Search, Loader2,
    CheckCircle2, XCircle, Clock, AlertTriangle, Eye, Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { WhatsAppPreview } from '@/components/templates/WhatsAppPreview';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type WabaTemplate = {
    id: number;
    instanceId: number;
    name: string;
    language: string;
    category: string;
    status: string;
    updatedAt: string;
    components: any[];
};

type InstanceItem = {
    dbId: number;
    instanceName: string;
    integration: string;
};

function StatusBadge({ status }: { status: string }) {
    const t = useTranslations('Templates');
    const s = status.toUpperCase();
    if (s === 'APPROVED') return <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20 gap-1"><CheckCircle2 className="h-3 w-3" /> {t('status_approved')}</Badge>;
    if (s === 'REJECTED') return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 border-destructive/20 gap-1"><XCircle className="h-3 w-3" /> {t('status_rejected')}</Badge>;
    if (s === 'PENDING') return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200 gap-1"><Clock className="h-3 w-3" /> {t('status_pending')}</Badge>;
    return <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3" /> {status}</Badge>;
}

function CategoryBadge({ category }: { category: string }) {
    const c = category.toUpperCase();
    let colorClass = "bg-muted text-muted-foreground border-border";
    if (c === 'MARKETING') colorClass = "bg-purple-500/10 text-purple-500 border-purple-500/20";
    if (c === 'UTILITY') colorClass = "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (c === 'AUTHENTICATION') colorClass = "bg-orange-500/10 text-orange-500 border-orange-500/20";
    return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${colorClass}`}>{c}</span>;
}

export default function TemplatesPage() {
    const t = useTranslations('Templates');
    const { data: templates, isLoading: loadingTemplates } = useSWR<WabaTemplate[]>('/api/templates/list', fetcher);
    const { data: instances, isLoading: loadingInstances } = useSWR<InstanceItem[]>('/api/instance/details', fetcher);
    const { data: featureData, isLoading: isFeatureLoading } = useSWR('/api/features?name=isTemplatesEnabled', fetcher);
    
    const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<WabaTemplate | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);

    const wabaInstances = (Array.isArray(instances) ? instances : []).filter(i => i.integration === 'WHATSAPP-BUSINESS');

    useEffect(() => {
        if (wabaInstances.length > 0 && !selectedInstanceId) {
            setSelectedInstanceId(wabaInstances[0].dbId.toString());
        }
    }, [wabaInstances]);

    const handleSync = async () => {
        if (!selectedInstanceId) return;
        setIsSyncing(true);
        try {
            const res = await fetch('/api/templates/sync', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId: selectedInstanceId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to sync');
            toast.success(data.message || 'Templates synced successfully');
            mutate('/api/templates/list');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleView = (template: WabaTemplate) => {
        setSelectedTemplate(template);
        setIsViewOpen(true);
    };

    if (loadingInstances) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    if (wabaInstances.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6">
                <Smartphone className="h-16 w-16 text-muted mb-4" />
                <h2 className="text-xl font-semibold text-foreground">{t('no_waba_instance_connected')}</h2>
                <p className="text-muted-foreground mb-6 text-center max-w-md">
                    {t('connect_waba_desc')}
                </p>
                <Link href="/settings/connect">
                    <Button>{t('connect_waba_btn')}</Button>
                </Link>
            </div>
        );
    }

    const filteredTemplates = templates?.filter(t => 
        t.instanceId.toString() === selectedInstanceId &&
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    return (
        <div className="flex flex-col h-full bg-muted p-6 overflow-hidden">
            <header className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('message_templates_title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('message_templates_desc')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                        <SelectTrigger className="w-[200px] bg-background">
                            <SelectValue placeholder={t('select_instance_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            {wabaInstances.map(inst => (
                                <SelectItem key={inst.dbId} value={inst.dbId.toString()}>
                                    {inst.instanceName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" onClick={handleSync} disabled={isSyncing || !selectedInstanceId} className="bg-background">
                        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        {t('sync_btn')}
                    </Button>
                    {featureData?.hasAccess && (
                        <Link href={`/templates/new`}>
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!selectedInstanceId}>
                                <Plus className="h-4 w-4 mr-2" /> {t('create_template_btn')}
                            </Button>
                        </Link>
                    )}
                </div>
            </header>

            <div className="flex items-center gap-4 mb-4 shrink-0">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder={t('search_templates_placeholder')}
                        className="pl-10 bg-background"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 bg-background rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-4">{t('template_name_header')}</div>
                    <div className="col-span-2">{t('category_header')}</div>
                    <div className="col-span-2">{t('language_header')}</div>
                    <div className="col-span-2">{t('status_header')}</div>
                    <div className="col-span-2 text-right">{t('actions_header')}</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loadingTemplates ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredTemplates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <LayoutTemplate className="h-12 w-12 mb-2 opacity-20" />
                            <p>{t('no_templates_found')}</p>
                            <p className="text-sm mt-1">{t('sync_or_create_new')}</p>
                        </div>
                    ) : (
                        filteredTemplates.map(tpl => (
                            <div key={tpl.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0 hover:bg-muted transition-colors items-center group">
                                <div className="col-span-4 font-medium text-foreground truncate" title={tpl.name}>
                                    {tpl.name}
                                </div>
                                <div className="col-span-2">
                                    <CategoryBadge category={tpl.category} />
                                </div>
                                <div className="col-span-2 text-sm text-muted-foreground">
                                    {tpl.language}
                                </div>
                                <div className="col-span-2">
                                    <StatusBadge status={tpl.status} />
                                </div>
                                <div className="col-span-2 flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleView(tpl)} title={t('view_preview_title')}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-[400px] p-0 bg-transparent border-none shadow-none flex justify-center items-center">
                    {selectedTemplate && (
                        <div className="transform scale-90 sm:scale-100 transition-transform">
                            <WhatsAppPreview data={selectedTemplate.components} />
                            <div className="mt-4 text-center">
                                <Badge variant="outline" className="bg-background/90 backdrop-blur text-foreground border-none shadow-sm">
                                    {selectedTemplate.name} ({selectedTemplate.language})
                                </Badge>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}