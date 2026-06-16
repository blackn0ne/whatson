import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { teamPhoneNumbers, callCredits, twilioConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkRoutePermission } from '@/lib/auth/permissions-guard';

export async function GET() {
  try {
    const { error, context } = await checkRoutePermission('settings');
    if (error) return error;

    const teamId = context!.teamId;

    
    const numbers = await db.query.teamPhoneNumbers.findMany({
      where: eq(teamPhoneNumbers.teamId, teamId),
    });

    
    const credits = await db.query.callCredits.findFirst({
      where: eq(callCredits.teamId, teamId),
    });

    
    const config = await db.query.twilioConfigs.findFirst({
      where: eq(twilioConfigs.isActive, true),
    });

    return NextResponse.json({
      hasNumbers: numbers.length > 0,
      numbers: numbers.map((n) => ({
        id: n.id,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        isActive: n.isActive,
        createdAt: n.createdAt,
      })),
      creditsBalance: credits?.balance ?? 0,
      voiceEnabled: !!config,
      pricing: config
        ? {
            creditPricePerPack: config.creditPricePerPack,
            creditsPerPack: config.creditsPerPack,
            pricePerNumber: config.pricePerNumber,
          }
        : null,
    });
  } catch (error: any) {
    console.error('[Settings Twilio GET]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
