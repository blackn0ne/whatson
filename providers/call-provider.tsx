'use client';

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export type CallStatus = 'idle' | 'confirming' | 'connecting' | 'ringing' | 'in-progress' | 'completed' | 'failed';

interface CallContact {
  name: string;
  number: string;
  avatar?: string;
  chatId?: number;
  jid?: string;
}

type PhoneNumberOption = { phoneNumber: string; friendlyName: string | null };

interface CallContextType {
  status: CallStatus;
  contact: CallContact | null;
  elapsed: number;
  isMuted: boolean;
  fromNumber: string;
  availableNumbers: PhoneNumberOption[];
  setFromNumber: (number: string) => void;
  openConfirmation: (contact: CallContact) => void;
  startCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  dismiss: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Chat');
  const [status, setStatus] = useState<CallStatus>('idle');
  const [contact, setContact] = useState<CallContact | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [fromNumber, setFromNumber] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState<PhoneNumberOption[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch {}
      callRef.current = null;
    }
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch {}
      deviceRef.current = null;
    }
  }, []);

  useEffect(() => {
    const isActive = status === 'connecting' || status === 'ringing' || status === 'in-progress';
    if (!isActive) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const openConfirmation = useCallback((c: CallContact) => {
    if (status !== 'idle') return;
    setContact(c);
    setStatus('confirming');
    setIsMuted(false);
    setElapsed(0);

    
    fetch('/api/calls/numbers/mine')
      .then((r) => r.json())
      .then((data) => {
        const nums: PhoneNumberOption[] = data.numbers || [];
        setAvailableNumbers(nums);
        setFromNumber(nums[0]?.phoneNumber || '');
      })
      .catch(() => { setAvailableNumbers([]); setFromNumber(''); });
  }, [status]);

  const startCall = useCallback(async () => {
    if (!contact) return;
    setStatus('connecting');

    let accessToken: string | null = null;
    try {
      const res = await fetch('/api/calls/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      accessToken = data.token;
    } catch {
      toast.error(t('voice_call_token_error'));
      setStatus('failed');
      return;
    }

    try {
      const { Device } = await import('@twilio/voice-sdk');
      const device = new Device(accessToken!, {
        codecPreferences: ['opus', 'pcmu'] as any,
        closeProtection: true,
      });
      deviceRef.current = device;
      await device.register();

      device.on('error', (err: any) => {
        console.error('[Call] Device error:', err);
      });

      const call = await device.connect({
        params: { To: contact.number },
      });
      callRef.current = call;

      let registered = false;
      const registerCall = (sid: string) => {
        if (registered || !sid) return;
        registered = true;
        fetch('/api/calls/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toNumber: contact.number, chatId: contact.chatId, callSid: sid }),
        }).catch((err) => console.error('[Call Register]', err));
      };

      call.on('ringing', () => {
        setStatus('ringing');
        registerCall((call as any).parameters?.CallSid || '');
      });
      call.on('accept', () => {
        setStatus('in-progress');
        setElapsed(0);
        timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
        registerCall((call as any).parameters?.CallSid || '');
      });
      call.on('disconnect', () => {
        setStatus('completed');
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      });
      call.on('cancel', () => {
        setStatus('completed');
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      });
      call.on('reject', () => {
        setStatus('failed');
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      });
      call.on('error', (err: any) => {
        console.error('[Twilio Call Error]', err.message, err.code, err);
        toast.error(t('voice_call_failed'));
        setStatus('failed');
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      });
    } catch (err: any) {
      console.error('[Twilio Device Error]', err);
      toast.error(t('voice_call_failed'));
      setStatus('failed');
    }
  }, [contact, t]);

  const hangup = useCallback(() => {
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch {}
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setStatus('completed');
  }, []);

  const toggleMute = useCallback(() => {
    if (callRef.current) {
      callRef.current.mute(!isMuted);
    }
    setIsMuted((p) => !p);
  }, [isMuted]);

  const dismiss = useCallback(() => {
    cleanup();
    setStatus('idle');
    setContact(null);
    setIsMuted(false);
    setElapsed(0);
    setFromNumber('');
    setAvailableNumbers([]);
  }, [cleanup]);

  return (
    <CallContext.Provider
      value={{
        status,
        contact,
        elapsed,
        isMuted,
        fromNumber,
        availableNumbers,
        setFromNumber,
        openConfirmation,
        startCall,
        hangup,
        toggleMute,
        dismiss,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}
