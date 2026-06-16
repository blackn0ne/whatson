import { NextResponse } from 'next/server';
import { isPluginInstalled } from '@/lib/plugins/registry';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.NEXT_PUBLIC_EVOLUTION_WEBHOOK_TOKEN;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verification successful');
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  console.warn('[Meta Webhook] Verification failed. Token mismatch.');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(request: Request) {
  const limited = checkRateLimit(`webhook:meta:${getClientIp(request)}`, RATE_LIMITS.webhook);
  if (limited) return limited;

  try {
    if (!isPluginInstalled('meta-cloud')) {
      return NextResponse.json({ error: 'Meta Cloud plugin not installed' }, { status: 400 });
    }

    const body = await request.json();

    
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ received: true, ignored: true });
    }

    const entries = body.entry;
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ received: true });
    }

    
    const { processMetaWebhook } = await import('@/lib/plugins/meta-cloud/webhook-handler');

    
    processMetaWebhook(entries).catch((e) => {
      console.error('[Meta Webhook] Processing error:', e);
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Meta Webhook] Error:', error.message);
    return NextResponse.json({ received: true });
  }
}
