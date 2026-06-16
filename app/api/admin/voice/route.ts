import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { twilioConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

function maskSecret(value: string): string {
  if (!value || value.length <= 8) return '••••••••';
  return value.slice(0, 4) + '••••' + value.slice(-4);
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const config = await db.query.twilioConfigs.findFirst();

    if (!config) {
      return NextResponse.json({ configured: false, config: null });
    }

    return NextResponse.json({
      configured: true,
      config: {
        id: config.id,
        accountSid: maskSecret(config.accountSid),
        authToken: maskSecret(config.authToken),
        apiKeySid: maskSecret(config.apiKeySid),
        apiKeySecret: maskSecret(config.apiKeySecret),
        twimlAppSid: config.twimlAppSid ? maskSecret(config.twimlAppSid) : null,
        creditPricePerPack: config.creditPricePerPack,
        creditsPerPack: config.creditsPerPack,
        pricePerNumber: config.pricePerNumber,
        paymentGatewayId: config.paymentGatewayId,
        currency: config.currency,
        isActive: config.isActive,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[Admin Voice GET]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret,
      twimlAppSid,
      creditPricePerPack,
      creditsPerPack,
      pricePerNumber,
      paymentGatewayId,
      currency,
      isActive,
    } = body;

    const isMasked = (v: string) => v && v.includes('••');
    const existing = await db.query.twilioConfigs.findFirst();

    
    if (!existing && (!accountSid || !authToken || !apiKeySid || !apiKeySecret)) {
      return NextResponse.json(
        { error: 'accountSid, authToken, apiKeySid, and apiKeySecret are required' },
        { status: 400 }
      );
    }

    if (existing) {
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };

      
      if (accountSid && !isMasked(accountSid)) updateData.accountSid = accountSid;
      if (authToken && !isMasked(authToken)) updateData.authToken = authToken;
      if (apiKeySid && !isMasked(apiKeySid)) updateData.apiKeySid = apiKeySid;
      if (apiKeySecret && !isMasked(apiKeySecret)) updateData.apiKeySecret = apiKeySecret;

      if (twimlAppSid !== undefined && !isMasked(twimlAppSid || '')) {
        updateData.twimlAppSid = twimlAppSid || null;
      }
      if (typeof creditPricePerPack === 'number') {
        updateData.creditPricePerPack = creditPricePerPack;
      }
      if (typeof creditsPerPack === 'number') {
        updateData.creditsPerPack = creditsPerPack;
      }
      if (typeof pricePerNumber === 'number') {
        updateData.pricePerNumber = pricePerNumber;
      }
      if (typeof isActive === 'boolean') {
        updateData.isActive = isActive;
      }
      if (paymentGatewayId !== undefined) {
        updateData.paymentGatewayId = paymentGatewayId || null;
      }
      if (currency) {
        updateData.currency = currency;
      }

      await db
        .update(twilioConfigs)
        .set(updateData)
        .where(eq(twilioConfigs.id, existing.id));
    } else {
      await db.insert(twilioConfigs).values({
        accountSid,
        authToken,
        apiKeySid,
        apiKeySecret,
        twimlAppSid: twimlAppSid || null,
        creditPricePerPack: typeof creditPricePerPack === 'number' ? creditPricePerPack : 500,
        creditsPerPack: typeof creditsPerPack === 'number' ? creditsPerPack : 100,
        pricePerNumber: typeof pricePerNumber === 'number' ? pricePerNumber : 500,
        paymentGatewayId: paymentGatewayId || null,
        currency: currency || 'usd',
        isActive: typeof isActive === 'boolean' ? isActive : false,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin Voice PUT]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
