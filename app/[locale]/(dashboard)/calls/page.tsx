'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Phone,
  PhoneOff,
  PhoneMissed,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Play,
  Pause,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type CallLog = {
  id: number;
  direction: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  duration: number | null;
  creditsUsed: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  recordingUrl: string | null;
  recordingSid: string | null;
  callerName?: string | null;
};

function CallStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    completed: { variant: 'default', label: 'Atendida' },
    'no-answer': { variant: 'secondary', label: 'Não atendida' },
    busy: { variant: 'secondary', label: 'Ocupado' },
    failed: { variant: 'destructive', label: 'Falhou' },
    canceled: { variant: 'outline', label: 'Cancelada' },
    initiated: { variant: 'outline', label: 'Iniciada' },
    ringing: { variant: 'outline', label: 'Tocando' },
    'in-progress': { variant: 'default', label: 'Em andamento' },
  };
  const c = config[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={c.variant} className="text-[11px]">{c.label}</Badge>;
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-1">
      <button onClick={toggle} className="h-7 w-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors">
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        preload="none"
      />
    </div>
  );
}

export default function CallsPage() {
  const t = useTranslations('Calls');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useSWR<{ calls: CallLog[]; total: number; page: number; totalPages: number }>(
    `/api/calls/history?page=${page}&limit=20`,
    fetcher,
  );

  const calls = data?.calls || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {}
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('description')}</p>
        </div>

        {}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data?.total ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{t('total_calls')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {calls.length > 0
                      ? formatDuration(
                          Math.round(calls.reduce((acc, c) => acc + (c.duration || 0), 0) / Math.max(calls.filter(c => c.duration).length, 1))
                        )
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('avg_duration')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <PhoneMissed className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {calls.length > 0
                      ? calls.filter(c => c.status === 'no-answer' || c.status === 'busy').length
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('missed_calls')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('history')}</CardTitle>
            <CardDescription>{t('history_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('col_date')}</TableHead>
                  <TableHead>{t('col_agent')}</TableHead>
                  <TableHead>{t('col_to')}</TableHead>
                  <TableHead>{t('col_status')}</TableHead>
                  <TableHead>{t('col_duration')}</TableHead>
                  <TableHead>{t('col_recording')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t('loading')}
                    </TableCell>
                  </TableRow>
                ) : calls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t('no_calls')}
                    </TableCell>
                  </TableRow>
                ) : (
                  calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="text-sm">{formatDate(call.startedAt || call.createdAt)}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{call.callerName || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{call.toNumber}</TableCell>
                      <TableCell><CallStatusBadge status={call.status} /></TableCell>
                      <TableCell className="text-sm tabular-nums">{formatDuration(call.duration)}</TableCell>
                      <TableCell>
                        {call.recordingSid ? (
                          <AudioPlayer src={`/api/calls/recording?sid=${call.recordingSid}`} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {t('page_info', { page, totalPages })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
