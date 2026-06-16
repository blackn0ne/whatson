import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { twilioConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { enforceFeature } from '@/lib/limits';
import { createTwilioClient } from '@/lib/plugins/voice-call/twilio-client';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const limited = checkRateLimit(`search:${getClientIp(request)}`, RATE_LIMITS.search);
    if (limited) return limited;

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 403 });
    }

    await enforceFeature(userWithTeam.teamId, 'isVoiceCallsEnabled');

    const config = await db.query.twilioConfigs.findFirst({
      where: eq(twilioConfigs.isActive, true),
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Voice calling is not configured. Contact the platform administrator.' },
        { status: 400 },
      );
    }

    const country = request.nextUrl.searchParams.get('country') || 'US';
    const contains = request.nextUrl.searchParams.get('contains') || '';
    const type = request.nextUrl.searchParams.get('type') || 'local';

    const client = createTwilioClient({
      accountSid: config.accountSid,
      authToken: config.authToken,
      apiKeySid: config.apiKeySid,
      apiKeySecret: config.apiKeySecret,
      twimlAppSid: config.twimlAppSid,
    });

    const searchParams: Record<string, any> = {
      limit: 20,
      voiceEnabled: true,
    };

    if (contains) {
      searchParams.contains = contains;
    }

    let numbers: any[] = [];

    try {
      if (type === 'tollFree') {
        numbers = await client.availablePhoneNumbers(country).tollFree.list(searchParams);
      } else if (type === 'mobile') {
        numbers = await client.availablePhoneNumbers(country).mobile.list(searchParams);
      } else {
        numbers = await client.availablePhoneNumbers(country).local.list(searchParams);
      }
    } catch (err: any) {
      
      if (err.code === 21452) {
        return NextResponse.json({ numbers: [], pricePerNumber: config.pricePerNumber });
      }
      throw err;
    }

    const available = numbers.map((n: any) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality || null,
      region: n.region || null,
      addressRequirements: n.addressRequirements || 'none',
      capabilities: {
        voice: n.capabilities?.voice ?? false,
        sms: n.capabilities?.sms ?? false,
        mms: n.capabilities?.mms ?? false,
      },
    }));

    return NextResponse.json({
      numbers: available,
      pricePerNumber: config.pricePerNumber,
    });
  } catch (error: any) {
    console.error('[Calls Numbers GET]', error.message);

    if (error.message?.includes('does not allow access')) {
      return NextResponse.json({ error: 'Feature not available on your plan' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
