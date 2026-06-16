'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, Banknote } from 'lucide-react';
import { toast } from 'sonner';

type PaymentRequest = {
  id: number;
  teamId: number;
  teamName: string | null;
  planName: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export function PendingPayments() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/offline-payments');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      const res = await fetch('/api/admin/offline-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error();
      toast.success(action === 'approve' ? 'Payment approved' : 'Request rejected');
      load();
    } catch {
      toast.error('Failed');
    } finally {
      setProcessingId(null);
    }
  };

  const pending = requests.filter(r => r.status === 'pending');
  const recent = requests.filter(r => r.status !== 'pending').slice(0, 5);

  if (isLoading) return null;
  if (requests.length === 0) return null;

  const formatAmount = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100);
    } catch {
      return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          Payment Requests
          {pending.length > 0 && (
            <Badge variant="default" className="text-[10px] h-5 px-1.5 ml-auto">
              {pending.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {pending.length === 0 && recent.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No requests</p>
        )}

        {}
        {pending.map((req) => (
          <div key={req.id} className="flex items-center gap-3 py-3 border-b last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{req.teamName || `Team #${req.teamId}`}</p>
              <p className="text-xs text-muted-foreground">
                {req.planName} · {formatAmount(req.amount, req.currency)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleAction(req.id, 'approve')}
                disabled={processingId === req.id}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-green-600 hover:bg-green-500/10 transition-colors disabled:opacity-50"
              >
                {processingId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              </button>
              <button
                onClick={() => handleAction(req.id, 'reject')}
                disabled={processingId === req.id}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {}
        {recent.map((req) => (
          <div key={req.id} className="flex items-center gap-3 py-3 border-b last:border-0 opacity-60">
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{req.teamName || `Team #${req.teamId}`}</p>
              <p className="text-xs text-muted-foreground">{req.planName}</p>
            </div>
            <Badge variant={req.status === 'approved' ? 'default' : 'destructive'} className="text-[10px]">
              {req.status === 'approved' ? 'Approved' : 'Rejected'}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
