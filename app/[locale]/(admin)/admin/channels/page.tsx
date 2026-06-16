'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Save, Server, Zap, Lock, Settings, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

function SecretInput({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`pr-9 ${className || ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export default function AdminChannelsPage() {
  const t = useTranslations('AdminChannels');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<'evolution' | 'meta-cloud' | null>(null);

  const [metaPluginInstalled, setMetaPluginInstalled] = useState(false);

  
  const [evoActive, setEvoActive] = useState(true);
  const [evoApiUrl, setEvoApiUrl] = useState('');
  const [evoApiKey, setEvoApiKey] = useState('');
  const [evoWebhookToken, setEvoWebhookToken] = useState('');

  const [metaActive, setMetaActive] = useState(false);
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaConfigId, setMetaConfigId] = useState('');
  const [metaWebhookToken, setMetaWebhookToken] = useState('');

  useEffect(() => {
    fetch('/api/admin/channels')
      .then(r => r.json())
      .then(data => {
        const evo = data.channels?.evolution;
        const meta = data.channels?.metaCloud;

        if (evo) {
          setEvoActive(evo.isActive);
          setEvoApiUrl(evo.apiUrl || '');
          setEvoApiKey(evo.apiKey || '');
          setEvoWebhookToken(evo.webhookToken || '');
        }

        if (meta) {
          setMetaActive(meta.isActive);
          setMetaAppId(meta.metaAppId || '');
          setMetaAppSecret(meta.metaAppSecret || '');
          setMetaConfigId(meta.metaConfigId || '');
          setMetaWebhookToken(meta.metaWebhookToken || '');
        }

        setMetaPluginInstalled(data.plugins?.metaCloud ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const saveChannel = async (channel: 'evolution' | 'meta-cloud') => {
    setSaving(channel);
    try {
      const payload = channel === 'evolution'
        ? { channel: 'evolution', isActive: evoActive, apiUrl: evoApiUrl, apiKey: evoApiKey, webhookToken: evoWebhookToken }
        : { channel: 'meta-cloud', isActive: metaActive, metaAppId, metaAppSecret, metaConfigId, metaWebhookToken };

      const res = await fetch('/api/admin/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();
      toast.success(t('saved_toast'));
      setOpenModal(null);
    } catch {
      toast.error(t('save_error_toast'));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {}
        <button
          onClick={() => setOpenModal('evolution')}
          className={`group relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 text-center
            ${evoActive
              ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20 hover:shadow-lg hover:border-emerald-500 cursor-pointer'
              : 'border-border bg-card hover:shadow-lg hover:border-muted-foreground/30 cursor-pointer'
            }`}
        >
          <div className="absolute top-3 right-3">
            {evoActive ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            )}
          </div>
          <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className={`p-3 rounded-xl ${evoActive ? 'bg-emerald-500/10' : 'bg-muted'}`}>
            <Server className={`h-7 w-7 ${evoActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="font-semibold text-sm">{t('evolution_title')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{t('evolution_desc')}</p>
          </div>
          <Badge variant={evoActive ? 'default' : 'secondary'} className="text-[10px] px-2 py-0">
            {evoActive ? t('enabled') : t('disabled')}
          </Badge>
        </button>

        {}
        <button
          onClick={() => metaPluginInstalled && setOpenModal('meta-cloud')}
          disabled={!metaPluginInstalled}
          className={`group relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 text-center
            ${!metaPluginInstalled
              ? 'border-dashed border-border bg-muted/30 opacity-50 cursor-not-allowed'
              : metaActive
                ? 'border-violet-500/50 bg-violet-50 dark:bg-violet-950/20 hover:shadow-lg hover:border-violet-500 cursor-pointer'
                : 'border-border bg-card hover:shadow-lg hover:border-muted-foreground/30 cursor-pointer'
            }`}
        >
          <div className="absolute top-3 right-3">
            {!metaPluginInstalled ? (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            ) : metaActive ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            )}
          </div>
          {metaPluginInstalled && (
            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
          <div className={`p-3 rounded-xl ${metaActive && metaPluginInstalled ? 'bg-violet-500/10' : 'bg-muted'}`}>
            <Zap className={`h-7 w-7 ${metaActive && metaPluginInstalled ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="font-semibold text-sm">{t('meta_cloud_title')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{t('meta_cloud_desc')}</p>
          </div>
          <Badge variant={metaActive && metaPluginInstalled ? 'default' : 'secondary'} className="text-[10px] px-2 py-0">
            {!metaPluginInstalled ? 'Plugin' : metaActive ? t('enabled') : t('disabled')}
          </Badge>
        </button>
      </div>

      {}
      <Dialog open={openModal === 'evolution'} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Server className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <DialogTitle>{t('evolution_title')}</DialogTitle>
                <DialogDescription className="text-xs">{t('evolution_desc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <Label className="font-medium">{evoActive ? t('enabled') : t('disabled')}</Label>
              <Switch checked={evoActive} onCheckedChange={setEvoActive} />
            </div>

            <p className="text-xs text-muted-foreground">{t('env_fallback_hint')}</p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('api_url_label')}</Label>
                <Input value={evoApiUrl} onChange={e => setEvoApiUrl(e.target.value)} placeholder={t('api_url_placeholder')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('api_key_label')}</Label>
                <SecretInput value={evoApiKey} onChange={e => setEvoApiKey(e.target.value)} placeholder={t('api_key_placeholder')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('webhook_token_label')}</Label>
                <SecretInput value={evoWebhookToken} onChange={e => setEvoWebhookToken(e.target.value)} placeholder={t('webhook_token_placeholder')} className="h-9 text-sm" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(null)}>{t('cancel_btn')}</Button>
            <Button onClick={() => saveChannel('evolution')} disabled={saving === 'evolution'}>
              {saving === 'evolution' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {t('save_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={openModal === 'meta-cloud'} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Zap className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <DialogTitle>{t('meta_cloud_title')}</DialogTitle>
                <DialogDescription className="text-xs">{t('meta_cloud_desc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <Label className="font-medium">{metaActive ? t('enabled') : t('disabled')}</Label>
              <Switch checked={metaActive} onCheckedChange={setMetaActive} />
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('meta_app_id_label')}</Label>
                <Input value={metaAppId} onChange={e => setMetaAppId(e.target.value)} placeholder={t('meta_app_id_placeholder')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('meta_app_secret_label')}</Label>
                <SecretInput value={metaAppSecret} onChange={e => setMetaAppSecret(e.target.value)} placeholder={t('meta_app_secret_placeholder')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('meta_config_id_label')}</Label>
                <Input value={metaConfigId} onChange={e => setMetaConfigId(e.target.value)} placeholder={t('meta_config_id_placeholder')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('meta_webhook_token_label')}</Label>
                <SecretInput value={metaWebhookToken} onChange={e => setMetaWebhookToken(e.target.value)} placeholder={t('meta_webhook_token_placeholder')} className="h-9 text-sm" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(null)}>{t('cancel_btn')}</Button>
            <Button onClick={() => saveChannel('meta-cloud')} disabled={saving === 'meta-cloud'}>
              {saving === 'meta-cloud' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {t('save_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
