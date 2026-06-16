'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Phone,
  Loader2,
  CreditCard,
  ShoppingCart,
  PhoneCall,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function VoiceSettingsPage() {
  const router = useRouter();
  const t = useTranslations('Settings');
  const { data: featureData, isLoading: isFeatureLoading } = useSWR(
    '/api/features?name=isVoiceCallsEnabled',
    fetcher
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState<number | null>(null);
  const [showNumberModal, setShowNumberModal] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [selectedType, setSelectedType] = useState('local');
  const [searchPrefix, setSearchPrefix] = useState('');
  const [purchasingNumber, setPurchasingNumber] = useState<string | null>(null);

  const [myNumbers, setMyNumbers] = useState<any[]>([]);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [pricing, setPricing] = useState<{
    creditPricePerPack: number;
    creditsPerPack: number;
    pricePerNumber: number;
  } | null>(null);

  const { data: creditsData, mutate: mutateCredits } = useSWR('/api/calls/credits', fetcher);

  useEffect(() => {
    if (!isFeatureLoading && featureData && !featureData.hasAccess) {
      toast.error(t('feature_not_available'));
      router.push('/dashboard');
    }
  }, [featureData, isFeatureLoading, router, t]);

  useEffect(() => {
    if (featureData?.hasAccess) {
      loadTeamVoiceData();
    }
  }, [featureData]);

  const loadTeamVoiceData = async () => {
    try {
      const res = await fetch('/api/calls/numbers/mine');
      if (res.ok) {
        const data = await res.json();
        setMyNumbers(data.numbers || []);
      }

      const settingsRes = await fetch('/api/settings/twilio');
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setCreditsBalance(settingsData.creditsBalance ?? 0);
        setPricing(settingsData.pricing ?? null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableNumbers = async (country: string, type: string, contains: string) => {
    setLoadingNumbers(true);
    setAvailableNumbers([]);
    try {
      const params = new URLSearchParams({ country, type });
      if (contains.trim()) params.set('contains', contains.trim());
      const res = await fetch(`/api/calls/numbers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableNumbers(data.numbers || []);
      } else {
        const errData = await res.json();
        toast.error(errData.error || t('voice_config_error'));
      }
    } catch {
      toast.error(t('voice_config_error'));
    } finally {
      setLoadingNumbers(false);
    }
  };

  const handleOpenBuyModal = () => {
    setShowNumberModal(true);
    loadAvailableNumbers(selectedCountry, selectedType, searchPrefix);
  };

  const handleSearch = () => {
    loadAvailableNumbers(selectedCountry, selectedType, searchPrefix);
  };

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    loadAvailableNumbers(country, selectedType, searchPrefix);
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    loadAvailableNumbers(selectedCountry, type, searchPrefix);
  };

  const handlePurchaseNumber = async (phoneNumber: string) => {
    setPurchasingNumber(phoneNumber);
    try {
      const res = await fetch('/api/calls/numbers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to purchase number');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast.error(error.message || t('voice_number_purchase_error'));
    } finally {
      setPurchasingNumber(null);
    }
  };

  const handlePurchaseCredits = async (packs: number) => {
    setIsPurchasing(packs);
    try {
      const res = await fetch('/api/calls/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packs }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.success(t('credits_purchased'));
        mutateCredits();
      }
    } catch {
      toast.error(t('credits_purchase_error'));
    } finally {
      setIsPurchasing(null);
    }
  };

  const formatCents = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (isLoading || isFeatureLoading || !featureData?.hasAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentBalance = creditsData?.balance ?? creditsBalance;

  return (
    <section className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-lg">
          <Phone className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg lg:text-2xl font-bold text-foreground">
            {t('voice_config_title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('voice_config_desc')}</p>
        </div>
      </div>

      <div className="space-y-6">
        {}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <PhoneCall className="h-4 w-4" /> {t('voice_my_numbers')}
                </CardTitle>
                <CardDescription>{t('voice_my_numbers_desc')}</CardDescription>
              </div>
              <Button size="sm" onClick={handleOpenBuyModal}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                {t('voice_buy_number')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {myNumbers.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('voice_phone_number')}</TableHead>
                      <TableHead>{t('voice_col_friendly_name')}</TableHead>
                      <TableHead>{t('voice_col_status')}</TableHead>
                      <TableHead>{t('voice_col_date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myNumbers.map((num: any) => (
                      <TableRow key={num.id}>
                        <TableCell className="font-mono text-sm">
                          {num.phoneNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {num.friendlyName || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={num.isActive ? 'default' : 'destructive'}>
                            {num.isActive ? t('voice_active') : t('voice_inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(num.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('voice_no_numbers')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleOpenBuyModal}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {t('voice_buy_number')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {}
        <Dialog open={showNumberModal} onOpenChange={setShowNumberModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('voice_available_numbers')}</DialogTitle>
              <DialogDescription>{t('voice_available_numbers_desc')}</DialogDescription>
            </DialogHeader>

            {}
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <Select value={selectedCountry} onValueChange={handleCountryChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">🇺🇸 United States</SelectItem>
                    <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                    <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                    <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                    <SelectItem value="BR">🇧🇷 Brazil</SelectItem>
                    <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                    <SelectItem value="FR">🇫🇷 France</SelectItem>
                    <SelectItem value="ES">🇪🇸 Spain</SelectItem>
                    <SelectItem value="IT">🇮🇹 Italy</SelectItem>
                    <SelectItem value="PT">🇵🇹 Portugal</SelectItem>
                    <SelectItem value="MX">🇲🇽 Mexico</SelectItem>
                    <SelectItem value="AR">🇦🇷 Argentina</SelectItem>
                    <SelectItem value="CL">🇨🇱 Chile</SelectItem>
                    <SelectItem value="CO">🇨🇴 Colombia</SelectItem>
                    <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                    <SelectItem value="IN">🇮🇳 India</SelectItem>
                    <SelectItem value="IL">🇮🇱 Israel</SelectItem>
                    <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                    <SelectItem value="NL">🇳🇱 Netherlands</SelectItem>
                    <SelectItem value="BE">🇧🇪 Belgium</SelectItem>
                    <SelectItem value="SE">🇸🇪 Sweden</SelectItem>
                    <SelectItem value="PL">🇵🇱 Poland</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedType} onValueChange={handleTypeChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="tollFree">Toll Free</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>

                {pricing && (
                  <p className="text-sm text-muted-foreground ml-auto">
                    {formatCents(pricing.pricePerNumber)}/mo
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('voice_search_prefix_placeholder')}
                    value={searchPrefix}
                    onChange={(e) => setSearchPrefix(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleSearch} disabled={loadingNumbers}>
                  {loadingNumbers ? <Loader2 className="h-4 w-4 animate-spin" /> : t('voice_search_btn')}
                </Button>
              </div>
            </div>

            {loadingNumbers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableNumbers.length > 0 ? (
              <div className="space-y-2">
                {availableNumbers.map((num: any) => (
                  <div
                    key={num.phoneNumber}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-mono text-sm font-medium">{num.phoneNumber}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {num.locality && (
                          <span className="text-xs text-muted-foreground">{num.locality}{num.region ? `, ${num.region}` : ''}</span>
                        )}
                        {!num.locality && num.friendlyName && (
                          <span className="text-xs text-muted-foreground">{num.friendlyName}</span>
                        )}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {num.capabilities?.voice && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">Voice</Badge>
                        )}
                        {num.capabilities?.sms && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">SMS</Badge>
                        )}
                        {num.capabilities?.mms && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">MMS</Badge>
                        )}
                        {num.addressRequirements !== 'none' && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">{t('voice_address_required')}</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={purchasingNumber !== null}
                      onClick={() => handlePurchaseNumber(num.phoneNumber)}
                    >
                      {purchasingNumber === num.phoneNumber ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ShoppingCart className="mr-1 h-3 w-3" />
                          {t('voice_buy_btn')}
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{t('voice_no_available_numbers')}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> {t('voice_credits_title')}
            </CardTitle>
            <CardDescription>{t('voice_credits_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">{t('voice_current_balance')}</p>
                <p className="text-3xl font-bold">{currentBalance}</p>
              </div>
              <span className="text-sm text-muted-foreground">{t('voice_credits_unit')}</span>
            </div>

            {pricing && (
              <div>
                <p className="text-sm font-medium mb-3">{t('voice_purchase_credits')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[1, 5, 10].map((packs) => (
                    <button
                      key={packs}
                      onClick={() => handlePurchaseCredits(packs)}
                      disabled={isPurchasing !== null}
                      className="flex flex-col items-center gap-1 p-4 border rounded-lg hover:bg-muted/50 hover:border-primary/30 transition-colors disabled:opacity-50"
                    >
                      {isPurchasing === packs ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <span className="text-lg font-bold">
                            {packs * pricing.creditsPerPack}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t('voice_credits_unit')}
                          </span>
                          <span className="text-sm font-medium text-primary">
                            {formatCents(packs * pricing.creditPricePerPack)}
                          </span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </section>
  );
}
