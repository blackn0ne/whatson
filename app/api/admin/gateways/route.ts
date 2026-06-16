import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { paymentGateways } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

export async function GET() {
  try {
    const user = await getUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gateways = await db.query.paymentGateways.findMany({
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });

    
    const masked = gateways.map((gw) => ({
      ...gw,
      secretKey: gw.secretKey ? '••••••' + gw.secretKey.slice(-4) : '',
      webhookSecret: gw.webhookSecret ? '••••••' + gw.webhookSecret.slice(-4) : '',
    }));

    return NextResponse.json({ gateways: masked });
  } catch (error: any) {
    console.error('[Admin Gateways]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, gateway, displayName, publicKey, secretKey, webhookSecret, isActive } = body;

    if (!gateway || !publicKey || !secretKey) {
      return NextResponse.json({ error: 'gateway, publicKey and secretKey are required' }, { status: 400 });
    }

    if (id) {
      
      const updateData: any = {
        displayName: displayName || gateway,
        publicKey,
        isActive: isActive ?? false,
        updatedAt: new Date(),
      };
      
      if (secretKey && !secretKey.startsWith('••••')) {
        updateData.secretKey = secretKey;
      }
      if (webhookSecret && !webhookSecret.startsWith('••••')) {
        updateData.webhookSecret = webhookSecret;
      }

      const [updated] = await db.update(paymentGateways)
        .set(updateData)
        .where(eq(paymentGateways.id, id))
        .returning();

      return NextResponse.json({ gateway: updated });
    } else {
      
      const [created] = await db.insert(paymentGateways)
        .values({
          gateway,
          displayName: displayName || gateway,
          publicKey,
          secretKey,
          webhookSecret: webhookSecret || null,
          isActive: isActive ?? false,
        })
        .returning();

      return NextResponse.json({ gateway: created }, { status: 201 });
    }
  } catch (error: any) {
    console.error('[Admin Gateways]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
