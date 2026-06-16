'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import {
    ArrowLeft, Save, Loader2, Plus, Trash2,
    Type, Info, Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from 'sonner';
import { WhatsAppPreview } from '@/components/templates/WhatsAppPreview';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type InstanceItem = {
    dbId: number;
    instanceName: string;
    integration: string;
};

export default function NewTemplatePage() {
    const router = useRouter();
    const t = useTranslations('Templates');
    const { data: instances, isLoading: loadingInstances } = useSWR<InstanceItem[]>('/api/instance/details', fetcher);
    const { data: featureData, isLoading: isFeatureLoading } = useSWR('/api/features?name=isTemplatesEnabled', fetcher);
    
    const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    
    const [name, setName] = useState('');
    const [category, setCategory] = useState('MARKETING');
    const [language, setLanguage] = useState('pt_BR');
    
    
    const [headerType, setHeaderType] = useState('NONE'); 
    const [headerText, setHeaderText] = useState('');
    const [bodyText, setBodyText] = useState('');
    const [footerText, setFooterText] = useState('');
    const [buttons, setButtons] = useState<any[]>([]);

    const [headerHandle, setHeaderHandle] = useState(''); 
    const [headerVarExample, setHeaderVarExample] = useState(''); 
    const [bodyVarExamples, setBodyVarExamples] = useState<string[]>([]); 

    const wabaInstances = (Array.isArray(instances) ? instances : []).filter(i => i.integration === 'WHATSAPP-BUSINESS');

    useEffect(() => {
        if (!isFeatureLoading && featureData && !featureData.hasAccess) {
            toast.error(t('feature_not_available'));
            router.push('/dashboard');
        }
    }, [featureData, isFeatureLoading, router, t]);

    useEffect(() => {
        if (wabaInstances.length > 0 && !selectedInstanceId) {
            setSelectedInstanceId(wabaInstances[0].dbId.toString());
        }
    }, [wabaInstances, selectedInstanceId]); 

    useEffect(() => {
        const matches = bodyText.match(/\{\{\d+\}\}/g);
        if (matches) {
            const count = matches.length;
            setBodyVarExamples(prev => {
                const newArr = [...prev];
                while (newArr.length < count) newArr.push('');
                while (newArr.length > count) newArr.pop();
                return newArr;
            });
        } else {
            setBodyVarExamples([]);
        }
    }, [bodyText]);

    const handleAddButton = (type: string) => {
        if (buttons.length >= 3) return;
        setButtons([...buttons, { type, text: '', url: '', phone_number: '' }]);
    };

    const updateButton = (index: number, field: string, value: string) => {
        const newButtons = [...buttons];
        newButtons[index][field] = value;
        setButtons(newButtons);
    };

    const removeButton = (index: number) => {
        setButtons(buttons.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!selectedInstanceId) {
            toast.error(t('select_instance_toast_error'));
            return;
        }
        if (!name || !bodyText) {
            toast.error(t('name_body_required_toast_error'));
            return;
        }

        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && !headerHandle) {
            toast.error(t('media_header_handle_toast_error'));
            return;
        }
        if (headerType === 'TEXT' && headerText.includes('{{1}}') && !headerVarExample) {
            toast.error(t('header_variable_example_toast_error'));
            return;
        }
        if (bodyVarExamples.some(ex => !ex.trim())) {
            toast.error(t('body_variable_examples_toast_error'));
            return;
        }

        setIsSubmitting(true);

        const components = [];

        if (headerType !== 'NONE') {
            const headerComponent: any = { type: 'HEADER', format: headerType };
            if (headerType === 'TEXT') headerComponent.text = headerText;
            components.push(headerComponent);
        }

        components.push({ type: 'BODY', text: bodyText });

        if (footerText) components.push({ type: 'FOOTER', text: footerText });

        if (buttons.length > 0) {
            components.push({
                type: 'BUTTONS',
                buttons: buttons.map(btn => {
                    if (btn.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: btn.text };
                    if (btn.type === 'URL') return { type: 'URL', text: btn.text, url: btn.url };
                    if (btn.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phone_number };
                    return btn;
                })
            });
        }

        const examplesData = {
            headerHandle: headerHandle,
            headerVar: headerVarExample,
            bodyVars: bodyVarExamples
        };

        try {
            const res = await fetch('/api/templates/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instanceId: selectedInstanceId,
                    name: name.toLowerCase().replace(/\s+/g, '_'),
                    category,
                    language,
                    components,
                    examples: examplesData
                })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || t('failed_to_create_template_toast'));

            toast.success(t('template_submitted_success_toast'));
            router.push('/templates');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const insertVariable = (field: 'header' | 'body') => {
        if (field === 'body') {
            const nextVar = bodyVarExamples.length + 1;
            setBodyText(prev => prev + `{{${nextVar}}}`);
        }
        if (field === 'header') {
            setHeaderText(prev => prev + `{{1}}`);
        }
    };

    if (loadingInstances || isFeatureLoading || !featureData?.hasAccess) {
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

    return (
        <div className="flex flex-col h-full bg-muted">
            <header className="flex justify-between items-center px-6 py-4 bg-background border-b border-border shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">{t('create_template_title')}</h1>
                        <p className="text-sm text-muted-foreground">{t('create_template_desc')}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()}>{t('cancel_btn')}</Button>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2" />}
                        {t('submit_for_review_btn')}
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
                    
                    <div className="overflow-y-auto p-6 space-y-6 pb-20">

                        <Card className="p-5 space-y-4">
                            <h3 className="font-semibold text-foreground">{t('details_card_title')}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <Label>{t('waba_instance_label')}</Label>
                                    <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                                        <SelectTrigger><SelectValue placeholder={t('select_instance_placeholder')} /></SelectTrigger>
                                        <SelectContent>
                                            {wabaInstances.map(inst => (
                                                <SelectItem key={inst.dbId} value={inst.dbId.toString()}>
                                                    {inst.instanceName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('template_name_label')}</Label>
                                    <Input placeholder={t('template_name_placeholder')} value={name} onChange={e => setName(e.target.value)} className="lowercase" />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('language_label')}</Label>
                                    <Select value={language} onValueChange={setLanguage}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pt_BR">{t('language_pt_br')}</SelectItem>
                                            <SelectItem value="en_US">{t('language_en_us')}</SelectItem>
                                            <SelectItem value="es">{t('language_es')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <Label>{t('category_label')}</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MARKETING">{t('category_marketing')}</SelectItem>
                                            <SelectItem value="UTILITY">{t('category_utility')}</SelectItem>
                                            <SelectItem value="AUTHENTICATION">{t('category_authentication')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-5 space-y-4">
                            <h3 className="font-semibold text-foreground">{t('header_card_title')}</h3>
                            <Select value={headerType} onValueChange={setHeaderType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">{t('header_type_none')}</SelectItem>
                                    <SelectItem value="TEXT">{t('header_type_text')}</SelectItem>
                                    <SelectItem value="IMAGE">{t('header_type_image')}</SelectItem>
                                    <SelectItem value="VIDEO">{t('header_type_video')}</SelectItem>
                                    <SelectItem value="DOCUMENT">{t('header_type_document')}</SelectItem>
                                </SelectContent>
                            </Select>

                            {headerType === 'TEXT' && (
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label>{t('header_text_label')}</Label>
                                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => insertVariable('header')}>{t('add_variable_btn')}</Button>
                                    </div>
                                    <Input value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder={t('header_text_placeholder')} />
                                    {headerText.includes('{{1}}') && (
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">{t('example_for_var_label')}</Label>
                                            <Input value={headerVarExample} onChange={e => setHeaderVarExample(e.target.value)} placeholder={t('example_john_placeholder')} className="h-8 text-sm" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
                                <div className="space-y-2">
                                    <Alert className="bg-primary/10 border-primary/20">
                                        <Info className="h-4 w-4 text-primary"/>
                                        <AlertTitle className="text-primary">{t('media_handle_required_title')}</AlertTitle>
                                        <AlertDescription className="text-primary/80 text-xs">
                                            {t('media_handle_required_desc')}
                                        </AlertDescription>
                                    </Alert>
                                    <Label>{t('file_handle_id_example_label')}</Label>
                                    <Input 
                                        placeholder={t('file_handle_id_placeholder')}
                                        value={headerHandle} 
                                        onChange={e => setHeaderHandle(e.target.value)} 
                                    />
                                </div>
                            )}
                        </Card>

                        <Card className="p-5 space-y-4">
                            <div className="flex justify-between">
                                <h3 className="font-semibold text-foreground">{t('body_card_title')}</h3>
                                <Button variant="ghost" size="sm" className="h-6 text-xs bg-muted hover:bg-muted/80 text-muted-foreground" onClick={() => insertVariable('body')}>
                                    <Type className="h-3 w-3 mr-1" /> {t('add_body_variable_btn')}
                                </Button>
                            </div>
                            <Textarea 
                                value={bodyText} 
                                onChange={e => setBodyText(e.target.value)} 
                                placeholder={t('body_placeholder')}
                                className="min-h-[150px]"
                            />
                            
                            {bodyVarExamples.length > 0 && (
                                <div className="space-y-3 pt-2 border-t border-border">
                                    <Label className="text-xs text-muted-foreground uppercase font-bold">{t('variable_examples_required_label')}</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {bodyVarExamples.map((ex, idx) => (
                                            <div key={idx} className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">{`{{${idx + 1}}}`}</Label>
                                                <Input 
                                                    value={ex} 
                                                    onChange={e => {
                                                        const newArr = [...bodyVarExamples];
                                                        newArr[idx] = e.target.value;
                                                        setBodyVarExamples(newArr);
                                                    }} 
                                                    placeholder={t('example_for_var_placeholder', { s: idx + 1})}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>

                        <Card className="p-5 space-y-4">
                            <h3 className="font-semibold text-foreground">{t('footer_card_title')}</h3>
                            <Input value={footerText} onChange={e => setFooterText(e.target.value)} placeholder={t('footer_text_placeholder')} />
                        </Card>

                        <Card className="p-5 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-foreground">{t('buttons_card_title')}</h3>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleAddButton('QUICK_REPLY')} disabled={buttons.length >= 3}>{t('add_quick_reply_btn')}</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleAddButton('URL')} disabled={buttons.length >= 3}>{t('add_url_btn')}</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleAddButton('PHONE_NUMBER')} disabled={buttons.length >= 3}>{t('add_phone_btn')}</Button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {buttons.map((btn, idx) => (
                                    <div key={idx} className="flex gap-2 items-start bg-muted p-3 rounded-md border border-border">
                                        <div className="flex-1 space-y-2">
                                            <span className="text-xs font-bold text-muted-foreground">{btn.type.replace('_', ' ')}</span>
                                            <Input placeholder={t('button_text_placeholder')} value={btn.text} onChange={e => updateButton(idx, 'text', e.target.value)} className="h-8 bg-background" />
                                            {btn.type === 'URL' && <Input placeholder={t('url_placeholder')} value={btn.url} onChange={e => updateButton(idx, 'url', e.target.value)} className="h-8 bg-background" />}
                                            {btn.type === 'PHONE_NUMBER' && <Input placeholder={t('phone_number_placeholder')} value={btn.phone_number} onChange={e => updateButton(idx, 'phone_number', e.target.value)} className="h-8 bg-background" />}
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeButton(idx)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>


                    <div className="hidden lg:flex bg-muted items-center justify-center border-l border-border p-8">
                        <div className="fixed top-32">
                            <WhatsAppPreview 
                                headerType={headerType}
                                headerText={headerText}
                                bodyText={bodyText}
                                footerText={footerText}
                                buttons={buttons}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}