'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Bot, Loader2, Save, Key, BrainCircuit, Sliders, Paperclip, X, FileText, FileImage, File as FileIcon, UploadCloud, Database } from 'lucide-react';
import { getAiConfig, saveAiConfig, AiActionState } from './actions';
import { toast } from 'sonner';
import { ToolsManager } from '@/components/ai/ToolsManager';
import { SessionsSheet } from '@/components/sessions/SessionsSheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const MODELS = {
  openai: [
    { id: 'gpt-5.2', name: 'GPT-5.2' },
    { id: 'gpt-5.1', name: 'GPT-5.1' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
  ],
  gemini: [
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite (Recommended)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (preview)' },
  ]
};

const initialState: AiActionState = {
  error: '',
  success: ''
};

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export default function AiSettingsPage() {
  const router = useRouter();
  const t = useTranslations('Settings');
  const { data: featureData, isLoading: isFeatureLoading } = useSWR('/api/features?name=isAiEnabled', fetcher);
  const [state, formAction, isPending] = useActionState(saveAiConfig, initialState);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [isActive, setIsActive] = useState(false);
  const [provider, setProvider] = useState<'openai' | 'gemini'>('gemini');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);
  
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
        const config = await getAiConfig();
        if (config) {
            setIsActive(config.isActive);
            setProvider(config.provider as 'openai' | 'gemini');
            setModel(config.model);
            setApiKey(config.apiKey); 
            setSystemPrompt(config.systemPrompt || '');
            setTemperature(Number(config.temperature) || 0.7);
            setMaxTokens(config.maxOutputTokens || 1000);
            
            if (config.attachments && Array.isArray(config.attachments)) {
                setExistingAttachments(config.attachments as Attachment[]);
            } else {
                setExistingAttachments([]);
            }
        } else {
            setModel(MODELS['gemini'][0].id);
            setSystemPrompt("You are a helpful assistant representing the company. Be polite, professional, and concise.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (!isFeatureLoading && featureData && !featureData.hasAccess) {
        toast.error(t('feature_not_available'));
        router.push('/dashboard');
    }
  }, [featureData, isFeatureLoading, router, t]);

  useEffect(() => {
    if(featureData?.hasAccess) {
        loadData();
    }
  }, [featureData]);

  useEffect(() => {
    if (state.success) {
        toast.success(state.success);
        setNewFiles([]); 
        loadData();
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  useEffect(() => {
    const validModels = MODELS[provider].map(m => m.id);
    if (!validModels.includes(model) && validModels.length > 0) {
      setModel(validModels[0]);
    }
  }, [provider, model]); 

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const filesArray = Array.from(e.target.files);
        setNewFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index: number) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <FileImage className="h-8 w-8 text-purple-500 mb-2" />;
    if (type.includes('pdf') || type.includes('text')) return <FileText className="h-8 w-8 text-blue-500 mb-2" />;
    return <FileIcon className="h-8 w-8 text-gray-500 mb-2" />;
  };

  if (isLoadingData || isFeatureLoading || !featureData?.hasAccess) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <section className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-purple-500/10 rounded-lg">
            <Bot className="h-6 w-6 text-purple-600" />
        </div>
        <div className="flex-1">
            <h1 className="text-lg lg:text-2xl font-bold text-foreground">{t('ai_agent_config_title')}</h1>
            <p className="text-sm text-muted-foreground">{t('ai_agent_config_desc')}</p>
        </div>
        <SessionsSheet type="ai" />
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="general">{t('general_settings_tab')}</TabsTrigger>
            <TabsTrigger value="tools">{t('function_calling_tools_tab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
            <form action={formAction} className="space-y-6">
                <input type="hidden" name="existingAttachments" value={JSON.stringify(existingAttachments)} />
                <input 
                    type="file" 
                    name="files" 
                    multiple 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect} 
                />

                <Card className={`border-l-4 transition-colors ${isActive ? 'border-l-green-500' : 'border-l-muted'}`}>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{t('activation_status_title')}</CardTitle>
                                <CardDescription>{t('activation_status_desc')}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">
                                    {isActive ? t('ai_enabled_checkbox') : t('ai_disabled_checkbox')}
                                </Label>
                                <Switch 
                                    id="isActive" 
                                    name="isActive" 
                                    checked={isActive} 
                                    onCheckedChange={setIsActive} 
                                />
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4" /> {t('provider_model_title')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('ai_provider_label')}</Label>
                                <Select name="provider" value={provider} onValueChange={(v: any) => setProvider(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gemini">{t('google_gemini_select')}</SelectItem>
                                        <SelectItem value="openai">{t('openai_chatgpt_select')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>{t('model_version_label')}</Label>
                                <Select name="model" value={model} onValueChange={setModel}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {MODELS[provider].map((m) => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Key className="h-3 w-3" /> {t('api_key_label')}
                                </Label>
                                <Input 
                                    name="apiKey" 
                                    type="password" 
                                    value={apiKey} 
                                    onChange={(e) => setApiKey(e.target.value)} 
                                    placeholder={provider === 'openai' ? 'sk-...' : 'AIza...'}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Sliders className="h-4 w-4" /> {t('parameters_title')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <Label>{t('temperature_label', { temperature: temperature })}</Label>
                                    <span className="text-xs text-muted-foreground">{temperature < 0.3 ? t('temperature_precise') : temperature > 0.8 ? t('temperature_creative') : t('temperature_balanced')}</span>
                                </div>
                                <Slider 
                                    value={[temperature]} 
                                    min={0} 
                                    max={2} 
                                    step={0.1} 
                                    onValueChange={(v) => setTemperature(v[0])} 
                                />
                                <input type="hidden" name="temperature" value={temperature} />
                            </div>

                            <div className="space-y-2">
                                <Label>{t('max_output_tokens_label')}</Label>
                                <Input 
                                    type="number" 
                                    name="maxOutputTokens" 
                                    value={maxTokens} 
                                    onChange={(e) => setMaxTokens(Number(e.target.value))} 
                                />
                                <p className="text-[10px] text-muted-foreground">{t('max_output_tokens_desc')}</p>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Database className="h-4 w-4" /> {t('system_instructions_title')}
                            </CardTitle>
                            <CardDescription>{t('system_instructions_desc')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Textarea 
                                name="systemPrompt" 
                                value={systemPrompt} 
                                onChange={(e) => setSystemPrompt(e.target.value)} 
                                className="min-h-[200px] font-mono text-sm"
                                placeholder="You are a helpful assistant..."
                            />
                            
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="flex items-center gap-2">
                                        <UploadCloud className="h-4 w-4" /> Knowledge Base (Gallery)
                                    </Label>
                                </div>

                                <div className="border rounded-lg p-4 bg-muted/5 min-h-[150px]">
                                    {existingAttachments.length === 0 && newFiles.length === 0 ? (
                                        <div 
                                            className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors py-8"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <UploadCloud className="h-10 w-10 mb-3 opacity-50" />
                                            <p className="text-sm font-medium">Drop files here or click to upload</p>
                                            <p className="text-xs opacity-70 mt-1">PDF, TXT, Images supported</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {existingAttachments.map((file, idx) => (
                                                <div key={`existing-${idx}`} className="relative group flex flex-col items-center justify-center p-4 border rounded-lg bg-card hover:shadow-md transition-all h-32">
                                                     <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive rounded-full"
                                                        onClick={() => removeExistingAttachment(idx)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                    {getFileIcon(file.type)}
                                                    <span className="text-xs text-center font-medium w-full truncate px-1" title={file.name}>{file.name}</span>
                                                    <span className="text-[10px] text-muted-foreground mt-1">{(file.size / 1024).toFixed(0)}KB</span>
                                                </div>
                                            ))}
                                            
                                            {newFiles.map((file, idx) => (
                                                <div key={`new-${idx}`} className="relative group flex flex-col items-center justify-center p-4 border border-dashed border-primary/50 rounded-lg bg-primary/5 h-32">
                                                     <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="absolute top-1 right-1 h-6 w-6 hover:bg-destructive/10 hover:text-destructive rounded-full"
                                                        onClick={() => removeNewFile(idx)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                    {getFileIcon(file.type)}
                                                    <span className="text-xs text-center font-medium w-full truncate px-1" title={file.name}>{file.name}</span>
                                                    <span className="text-[10px] text-primary mt-1">New</span>
                                                </div>
                                            ))}
                                            
                                            <div 
                                                className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors h-32"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <Paperclip className="h-6 w-6 mb-2 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">Add more</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-end mt-6">
                    <Button type="submit" disabled={isPending} className="min-w-[150px]">
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {t('save_config_btn')}
                    </Button>
                </div>
            </form>
        </TabsContent>

        <TabsContent value="tools">
            <ToolsManager />
        </TabsContent>
      </Tabs>
    </section>
  );
}