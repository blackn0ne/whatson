'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CreditCard, Loader2, Save, Check, Info, ChevronDown, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

type GatewayConfig = {
  id?: number;
  gateway: string;
  displayName: string;
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  isActive: boolean;
};

const GATEWAYS = [
  {
    value: 'stripe',
    fields: [
      { key: 'secretKey', placeholder: 'sk_live_...', type: 'password' },
      { key: 'webhookSecret', placeholder: 'whsec_...', type: 'password', optional: true },
    ],
  },
  {
    value: 'razorpay',
    fields: [
      { key: 'publicKey', placeholder: 'rzp_live_...', type: 'text' },
      { key: 'secretKey', placeholder: 'Key Secret', type: 'password' },
      { key: 'webhookSecret', placeholder: 'Webhook Secret', type: 'password', optional: true },
    ],
  },
  {
    value: 'offline',
    fields: [],
  },
];

export default function AdminGatewaysPage() {
  const t = useTranslations('AdminGateways');
  const [configs, setConfigs] = useState<Record<string, GatewayConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingGateway, setSavingGateway] = useState<string | null>(null);
  const [expandedGateway, setExpandedGateway] = useState<string | null>(null);

  useEffect(() => { loadGateways(); }, []);

  const loadGateways = async () => {
    try {
      const res = await fetch('/api/admin/gateways');
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, GatewayConfig> = {};
        (data.gateways || []).forEach((gw: GatewayConfig) => { map[gw.gateway] = gw; });
        setConfigs(map);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const getConfig = (gatewayType: string): GatewayConfig => {
    return configs[gatewayType] || {
      gateway: gatewayType,
      displayName: gatewayType,
      publicKey: '',
      secretKey: '',
      webhookSecret: '',
      isActive: false,
    };
  };

  const updateField = (gatewayType: string, field: string, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [gatewayType]: { ...getConfig(gatewayType), ...prev[gatewayType], [field]: value },
    }));
  };

  const handleSave = async (gatewayType: string) => {
    const config = getConfig(gatewayType);
    setSavingGateway(gatewayType);
    try {
      const payload = { ...config, displayName: t(`${gatewayType}_label`) };
      if (gatewayType === 'stripe' && !payload.publicKey) {
        payload.publicKey = payload.secretKey;
      }
      if (gatewayType === 'offline') {
        payload.publicKey = 'offline';
        payload.secretKey = 'offline';
      }
      const res = await fetch('/api/admin/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(t('saved_toast'));
      loadGateways();
    } catch {
      toast.error(t('save_error_toast'));
    } finally {
      setSavingGateway(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-primary/10 rounded-lg">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <div className="space-y-4">
        {GATEWAYS.map((gw) => {
          const config = getConfig(gw.value);
          const isEnabled = config.isActive;
          const isSaving = savingGateway === gw.value;
          const isConfigured = !!configs[gw.value]?.id;
          const isExpanded = expandedGateway === gw.value;

          return (
            <Card
              key={gw.value}
              className={`transition-all ${isEnabled ? 'border-primary/30 shadow-sm' : 'opacity-80'}`}
            >
              <CardContent className="p-0">
                {}
                <button
                  type="button"
                  onClick={() => setExpandedGateway(isExpanded ? null : gw.value)}
                  className="flex items-center gap-4 px-5 py-4 w-full text-left"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-lg font-bold shrink-0">
                    {gw.value === 'stripe' ? 'S' : gw.value === 'razorpay' ? 'R' : <Banknote className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{t(`${gw.value}_label`)}</p>
                      {isConfigured && isEnabled && (
                        <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                          <Check className="h-2.5 w-2.5" /> {t('connected')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(`${gw.value}_desc`)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => {
                        updateField(gw.value, 'isActive', checked);
                        if (checked) setExpandedGateway(gw.value);
                      }}
                    />
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 border-t space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {gw.fields.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <Label className="text-xs">
                          {t(`field_${field.key}`)}
                          {field.optional && <span className="text-muted-foreground ml-1">({t('optional')})</span>}
                        </Label>
                        <Input
                          type={field.type}
                          value={(config as any)[field.key] || ''}
                          onChange={(e) => updateField(gw.value, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="h-9 text-sm"
                        />
                      </div>
                    ))}

                    {gw.value !== 'offline' && (
                    <div className="rounded-lg bg-muted/50 border border-border/50 p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium">{t('webhook_setup_title')}</span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-muted-foreground">
                        <p>{t(`${gw.value}_webhook_step1`)}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground/70">URL:</span>
                          <code className="bg-background border rounded px-1.5 py-0.5 text-[11px] font-mono text-foreground select-all">
                            {baseUrl}{gw.value === 'stripe' ? '/api/stripe/webhook' : '/api/webhook/razorpay'}
                          </code>
                        </div>
                        <p>{t(`${gw.value}_webhook_step2`)}</p>
                        <p>{t(`${gw.value}_webhook_step3`)}</p>
                      </div>
                    </div>
                    )}

                    {}
                    {gw.value === 'offline' && (
                    <div className="rounded-lg bg-muted/50 border border-border/50 p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium">{t('offline_info_title')}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t('offline_info_desc')}</p>
                    </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button onClick={() => handleSave(gw.value)} disabled={isSaving} size="sm">
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                        {t('save_btn')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
