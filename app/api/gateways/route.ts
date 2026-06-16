import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { paymentGateways } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const gateways = await db.query.paymentGateways.findMany({
      where: eq(paymentGateways.isActive, true),
      columns: { id: true, gateway: true, displayName: true },
    });

    return NextResponse.json({ gateways });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
