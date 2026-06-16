'use client';

import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { isPluginInstalled } from '@/lib/plugins/registry';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CallProvider = dynamic(
  () => import('@/providers/call-provider').then((m) => m.CallProvider),
  { ssr: false },
);
const CallConfirmDialog = dynamic(
  () => import('@/components/chat/CallModal').then((m) => m.CallConfirmDialog),
  { ssr: false },
);
const FloatingCallCard = dynamic(
  () => import('@/components/chat/CallModal').then((m) => m.FloatingCallCard),
  { ssr: false },
);

export function CallProviderWrapper({ children }: { children: React.ReactNode }) {
  const { data: features } = useSWR('/api/features/all', fetcher);
  const isEnabled = features?.isVoiceCallsEnabled === true && isPluginInstalled('voice-call');

  if (!isEnabled) {
    return <>{children}</>;
  }

  return (
    <CallProvider>
      {children}
      <CallConfirmDialog />
      <FloatingCallCard />
    </CallProvider>
  );
}
