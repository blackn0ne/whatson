import { db } from '@/lib/db/drizzle';
import { paymentGateways } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { PaymentGatewayAdapter } from './gateway';
import { StripeAdapter } from './adapters/stripe-adapter';
import { RazorpayAdapter } from './adapters/razorpay-adapter';
import { OfflineAdapter } from './adapters/offline-adapter';

export async function getGatewayById(gatewayId: number): Promise<PaymentGatewayAdapter> {
  const gw = await db.query.paymentGateways.findFirst({
    where: eq(paymentGateways.id, gatewayId),
  });

  if (!gw || !gw.isActive) {
    throw new Error('Payment gateway not found or inactive');
  }

  return createAdapter(gw);
}

export async function getGatewayByType(type: string): Promise<PaymentGatewayAdapter> {
  const gw = await db.query.paymentGateways.findFirst({
    where: and(
      eq(paymentGateways.gateway, type),
      eq(paymentGateways.isActive, true),
    ),
  });

  if (!gw) {
    throw new Error(`No active ${type} gateway found`);
  }

  return createAdapter(gw);
}

export async function getActiveGateways() {
  return db.query.paymentGateways.findMany({
    where: eq(paymentGateways.isActive, true),
  });
}

function createAdapter(gw: typeof paymentGateways.$inferSelect): PaymentGatewayAdapter {
  switch (gw.gateway) {
    case 'stripe':
      return new StripeAdapter(gw.secretKey, gw.webhookSecret || undefined);
    case 'razorpay':
      return new RazorpayAdapter(gw.publicKey, gw.secretKey, gw.webhookSecret || undefined);
    case 'offline':
      return new OfflineAdapter();
    default:
      throw new Error(`Unsupported gateway type: ${gw.gateway}`);
  }
}
