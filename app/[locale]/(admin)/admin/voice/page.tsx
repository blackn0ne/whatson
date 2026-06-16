'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Loader2, Save, DollarSign, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export default function AdminVoicePage() {
  const t = useTranslations('AdminVoice');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [apiKeySid, setApiKeySid] = useState('');
  const [apiKeySecret, setApiKeySecret] = useState('');
  const [twimlAppSid, setTwimlAppSid] = useState('');

  const [creditPricePerPack, setCreditPricePerPack] = useState(1000);
  const [creditsPerPack, setCreditsPerPack] = useState(50);
  const [pricePerNumber, setPricePerNumber] = useState(1000);
  const [paymentGatewayId, setPaymentGatewayId] = useState<string>('');
  const [currency, setCurrency] = useState('usd');
  const [gateways, setGateways] = useState<{ id: number; gateway: string; displayName: string }[]>([]);

  
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    loadConfig();
    loadGateways();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/admin/voice');
      if (res.ok) {
        const data = await res.json();
        if (data.configured && data.config) {
          setAccountSid(data.config.accountSid || '');
          setAuthToken(data.config.authToken || '');
          setApiKeySid(data.config.apiKeySid || '');
          setApiKeySecret(data.config.apiKeySecret || '');
          setTwimlAppSid(data.config.twimlAppSid || '');
          setCreditPricePerPack(data.config.creditPricePerPack ?? 1000);
          setCreditsPerPack(data.config.creditsPerPack ?? 50);
          setPricePerNumber(data.config.pricePerNumber ?? 1000);
          setPaymentGatewayId(data.config.paymentGatewayId?.toString() || '');
          setCurrency(data.config.currency || 'usd');
          setIsActive(data.config.isActive ?? false);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGateways = async () => {
    try {
      const res = await fetch('/api/gateways');
      if (res.ok) {
        const data = await res.json();
        setGateways(data.gateways || []);
      }
    } catch {}
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/voice', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid,
          authToken,
          apiKeySid,
          apiKeySecret,
          twimlAppSid: twimlAppSid || null,
          creditPricePerPack,
          creditsPerPack,
          pricePerNumber,
          paymentGatewayId: paymentGatewayId ? parseInt(paymentGatewayId) : null,
          currency,
          isActive,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('save_success'));
    } catch {
      toast.error(t('save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-lg">
          <Phone className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" /> {t('credentials_title')}
          </CardTitle>
          <CardDescription>{t('credentials_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="accountSid">{t('account_sid')}</Label>
              <Input
                id="accountSid"
                type="password"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="authToken">{t('auth_token')}</Label>
              <Input
                id="authToken"
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKeySid">{t('api_key_sid')}</Label>
              <Input
                id="apiKeySid"
                type="password"
                value={apiKeySid}
                onChange={(e) => setApiKeySid(e.target.value)}
                placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKeySecret">{t('api_key_secret')}</Label>
              <Input
                id="apiKeySecret"
                type="password"
                value={apiKeySecret}
                onChange={(e) => setApiKeySecret(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="twimlAppSid">{t('twiml_app_sid')}</Label>
              <Input
                id="twimlAppSid"
                type="password"
                value={twimlAppSid}
                onChange={(e) => setTwimlAppSid(e.target.value)}
                placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">{t('twiml_app_sid_hint')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> {t('billing_gateway_title')}
          </CardTitle>
          <CardDescription>{t('billing_gateway_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('billing_gateway_select')}</Label>
              <Select value={paymentGatewayId} onValueChange={setPaymentGatewayId}>
                <SelectTrigger><SelectValue placeholder={t('billing_gateway_placeholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('billing_gateway_none')}</SelectItem>
                  {gateways.map((gw) => (
                    <SelectItem key={gw.id} value={gw.id.toString()}>{gw.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('billing_currency')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD ($)</SelectItem>
                  <SelectItem value="brl">BRL (R$)</SelectItem>
                  <SelectItem value="eur">EUR (€)</SelectItem>
                  <SelectItem value="gbp">GBP (£)</SelectItem>
                  <SelectItem value="inr">INR (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> {t('pricing_credits_title')}
          </CardTitle>
          <CardDescription>{t('pricing_credits_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('minutes_per_pack')}</Label>
              <span className="text-sm font-bold tabular-nums">{creditsPerPack} {t('minutes')}</span>
            </div>
            <Slider
              value={[creditsPerPack]}
              onValueChange={([v]) => setCreditsPerPack(v)}
              min={10}
              max={500}
              step={10}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>10 min</span>
              <span>500 min</span>
            </div>
          </div>

          {}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('pack_price')}</Label>
              <span className="text-sm font-bold tabular-nums">${(creditPricePerPack / 100).toFixed(2)}</span>
            </div>
            <Slider
              value={[creditPricePerPack]}
              onValueChange={([v]) => setCreditPricePerPack(v)}
              min={100}
              max={10000}
              step={50}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>$1.00</span>
              <span>$100.00</span>
            </div>
          </div>

          {}
          <div className="rounded-lg bg-muted/50 border p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3 w-3" /> {t('pricing_preview')}
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-background p-3 border">
                <p className="text-lg font-bold">{creditsPerPack}</p>
                <p className="text-[11px] text-muted-foreground">{t('minutes')}</p>
                <p className="text-sm font-semibold text-primary mt-1">${(creditPricePerPack / 100).toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-background p-3 border">
                <p className="text-lg font-bold">{creditsPerPack * 5}</p>
                <p className="text-[11px] text-muted-foreground">{t('minutes')}</p>
                <p className="text-sm font-semibold text-primary mt-1">${((creditPricePerPack * 5) / 100).toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-background p-3 border">
                <p className="text-lg font-bold">{creditsPerPack * 10}</p>
                <p className="text-[11px] text-muted-foreground">{t('minutes')}</p>
                <p className="text-sm font-semibold text-primary mt-1">${((creditPricePerPack * 10) / 100).toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {t('cost_per_minute')}: <span className="font-semibold">${creditsPerPack > 0 ? (creditPricePerPack / creditsPerPack / 100).toFixed(4) : '0'}</span> / {t('minute')}
            </p>
          </div>
        </CardContent>
      </Card>

      {}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" /> {t('pricing_numbers_title')}
          </CardTitle>
          <CardDescription>{t('pricing_numbers_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{t('monthly_rental')}</Label>
            <span className="text-sm font-bold tabular-nums">${(pricePerNumber / 100).toFixed(2)}/{t('month')}</span>
          </div>
          <Slider
            value={[pricePerNumber]}
            onValueChange={([v]) => setPricePerNumber(v)}
            min={100}
            max={5000}
            step={50}
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>$1.00</span>
            <span>$50.00</span>
          </div>
        </CardContent>
      </Card>

      {}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                id="voiceActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="voiceActive" className="text-sm font-medium cursor-pointer">
                {isActive ? t('status_active') : t('status_inactive')}
              </Label>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('save_btn')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
