import { handleCallStatusUpdate } from '@/lib/plugins/voice-call/service';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const limited = checkRateLimit(`webhook:${getClientIp(request)}`, RATE_LIMITS.webhook);
    if (limited) return limited;

    const contentType = request.headers.get('content-type') || '';

    let formData: Record<string, string> = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        formData[key] = value;
      });
    } else {
      try {
        formData = await request.json();
      } catch {
        formData = {};
      }
    }

    const callSid = formData['CallSid'];
    const callStatus = formData['CallStatus'];
    const callDuration = formData['CallDuration'];
    const recordingUrl = formData['RecordingUrl'];
    const recordingSid = formData['RecordingSid'];

    if (!callSid) {
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    await handleCallStatusUpdate(
      callSid,
      callStatus || 'unknown',
      callDuration ? parseInt(callDuration, 10) : undefined,
      recordingUrl || undefined,
      recordingSid || undefined,
    );

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error: any) {
    console.error('[Twilio Webhook]', error.message);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
