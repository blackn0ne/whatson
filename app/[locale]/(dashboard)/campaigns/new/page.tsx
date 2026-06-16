'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import * as XLSX from 'xlsx';
import { ArrowLeft, Upload, FileSpreadsheet, Send, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { WhatsAppPreview } from '@/components/templates/WhatsAppPreview';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NewCampaignPage() {
    const t = useTranslations('NewCampaign');
    const router = useRouter();
    const { data: instances } = useSWR<any[]>('/api/instance/details', fetcher);
    const { data: templates } = useSWR<any[]>('/api/templates/list', fetcher);
    const { data: featureData, isLoading: isFeatureLoading } = useSWR('/api/features?name=isCampaignsEnabled', fetcher);

    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [instanceId, setInstanceId] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [leads, setLeads] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [createContacts, setCreateContacts] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isFeatureLoading && featureData && !featureData.hasAccess) {
            toast.error(t('toasts.no_access'));
            router.push('/dashboard');
        }
    }, [featureData, isFeatureLoading, router, t]);

    const wabaInstances = (Array.isArray(instances) ? instances : []).filter((i: any) => i.integration === 'WHATSAPP-BUSINESS');
    const selectedTemplate = Array.isArray(templates) ? templates.find((t: any) => t.id.toString() === selectedTemplateId) : undefined;

    const handleDownloadTemplate = () => {
        const data = [
            { phone: '5511999999999', '1': 'João', '2': 'Empresa ABC' },
            { phone: '5511888888888', '1': 'Maria', '2': 'Empresa XYZ' },
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const cell = ws[XLSX.utils.encode_cell({ r: row, c: 0 })];
            if (cell) { cell.t = 's'; cell.z = '@'; }
        }
        if (!ws['!cols']) ws['!cols'] = [];
        ws['!cols'][0] = { wch: 18 };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Leads');
        XLSX.writeFile(wb, 'campaign_template.xlsx');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target?.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

            const parsed = rows.map((row: any) => {
                const phone = String(row.phone || row.telephone || row.celular || row.mobile || '').replace(/\D/g, '');
                return { phone, variables: row };
            }).filter((r: any) => r.phone);

            if (parsed.length === 0) {
                toast.error(t('leads.error_no_phone'));
            } else {
                setLeads(parsed);
                toast.success(t('leads.success_loaded', { count: parsed.length }));
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/campaigns/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    instanceId,
                    scheduledAt,
                    templateId: selectedTemplateId,
                    leads,
                    createContacts
                })
            });
            
            if (!res.ok) throw new Error('Failed to create campaign');
            
            toast.success(t('toasts.created'));
            router.push('/campaigns');
        } catch (error) {
            toast.error(t('toasts.error_create'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isFeatureLoading || !featureData?.hasAccess) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-muted">
            <header className="flex justify-between items-center px-6 py-4 bg-background border-b border-border">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
                    <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
                </div>
            </header>

            <div className="flex-1 p-8 max-w-5xl mx-auto w-full">
                <div className="flex items-center justify-center mb-8">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={`flex items-center ${s < 3 ? 'w-full' : ''}`}>
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                {s}
                            </div>
                            {s < 3 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
                        </div>
                    ))}
                </div>

                <Card className="p-6">
                    {step === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-semibold">{t('details.title')}</h2>
                            <div className="space-y-2">
                                <Label>{t('details.name_label')}</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('details.name_placeholder')} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('details.instance_label')}</Label>
                                <Select value={instanceId} onValueChange={setInstanceId}>
                                    <SelectTrigger><SelectValue placeholder={t('details.instance_placeholder')} /></SelectTrigger>
                                    <SelectContent>
                                        {wabaInstances.map((i: any) => (
                                            <SelectItem key={i.dbId} value={i.dbId.toString()}>{i.instanceName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('details.schedule_label')}</Label>
                                <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                                <p className="text-xs text-muted-foreground">{t('details.schedule_desc')}</p>
                            </div>
                            <div className="flex items-start space-x-3">
                                <Checkbox id="createContacts" checked={createContacts} onCheckedChange={(v) => setCreateContacts(v === true)} />
                                <div className="space-y-1">
                                    <Label htmlFor="createContacts" className="cursor-pointer">{t('details.create_contacts_label')}</Label>
                                    <p className="text-xs text-muted-foreground">{t('details.create_contacts_desc')}</p>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button disabled={!name || !instanceId} onClick={() => setStep(2)}>{t('details.next_btn')}</Button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-semibold">{t('leads.title')}</h2>
                            <div className="border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center justify-center bg-muted hover:bg-muted/80 transition-colors cursor-pointer relative">
                                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium text-foreground">{t('leads.upload_text')}</p>
                                <p className="text-xs text-muted-foreground mt-1">{t('leads.upload_hint')}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
                                <Download className="h-4 w-4" />
                                {t('leads.download_template')}
                            </Button>
                            
                            {leads.length > 0 && (
                                <div className="bg-primary/10 p-4 rounded-md flex items-center text-primary">
                                    <FileSpreadsheet className="h-5 w-5 mr-2" />
                                    <span className="font-medium">{t('leads.success_loaded', { count: leads.length })}</span>
                                </div>
                            )}

                            <div className="flex justify-between">
                                <Button variant="outline" onClick={() => setStep(1)}>{t('leads.back_btn')}</Button>
                                <Button disabled={leads.length === 0} onClick={() => setStep(3)}>{t('leads.next_btn')}</Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-semibold">{t('content.title')}</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>{t('content.template_label')}</Label>
                                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                            <SelectTrigger><SelectValue placeholder={t('content.template_placeholder')} /></SelectTrigger>
                                            <SelectContent>
                                                {templates?.filter((t: any) => t.status === 'APPROVED' && t.instanceId.toString() === instanceId).map((t: any) => (
                                                    <SelectItem key={t.id} value={t.id.toString()}>{t.name} ({t.language})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    {selectedTemplate && (
                                        <div className="p-4 bg-primary/10 text-primary rounded-md text-sm">
                                            <p className="font-bold mb-1">{t('content.mapping_title')}</p>
                                            <p>{t('content.mapping_desc')}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-center bg-muted rounded-xl p-4">
                                    {selectedTemplate ? (
                                        <div className="scale-75 origin-top">
                                            <WhatsAppPreview data={selectedTemplate.components} />
                                        </div>
                                    ) : (
                                        <div className="h-64 flex items-center justify-center text-muted-foreground">{t('content.preview_placeholder')}</div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between pt-4 border-t">
                                <Button variant="outline" onClick={() => setStep(2)}>{t('leads.back_btn')}</Button>
                                <Button className="bg-primary hover:bg-primary/90" onClick={handleSubmit} disabled={isSubmitting || !selectedTemplate}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                    {t('content.finish_btn')}
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}