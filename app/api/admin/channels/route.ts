import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { channelConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { clearChannelConfigCache } from '@/lib/whatsapp/config';
import { isPluginInstalled } from '@/lib/plugins/registry';

export async function GET() {
  try {
    const user = await getUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await db.select().from(channelConfigs);
    const evoRow = rows.find(r => r.channel === 'evolution');
    const metaRow = rows.find(r => r.channel === 'meta-cloud');

    
    const evolution = {
      channel: 'evolution',
      isActive: evoRow?.isActive ?? true,
      apiUrl: evoRow?.apiUrl || process.env.EVOLUTION_API_URL || '',
      apiKey: evoRow?.apiKey || process.env.AUTHENTICATION_API_KEY || '',
      webhookToken: evoRow?.webhookToken || process.env.NEXT_PUBLIC_EVOLUTION_WEBHOOK_TOKEN || '',
    };

    const metaCloud = {
      channel: 'meta-cloud',
      isActive: metaRow?.isActive ?? false,
      metaAppId: metaRow?.metaAppId || process.env.META_APP_ID || '',
      metaAppSecret: metaRow?.metaAppSecret || process.env.META_APP_SECRET || '',
      metaConfigId: metaRow?.metaConfigId || process.env.NEXT_PUBLIC_META_CONFIG_ID || '',
      metaWebhookToken: metaRow?.metaWebhookToken || process.env.META_WEBHOOK_VERIFY_TOKEN || '',
    };

    return NextResponse.json({
      channels: { evolution, metaCloud },
      plugins: { metaCloud: isPluginInstalled('meta-cloud') },
    });
  } catch (error: any) {
    console.error('[Admin Channels]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { channel, isActive, apiUrl, apiKey, webhookUrl, webhookToken, metaAppId, metaAppSecret, metaConfigId, metaWebhookToken } = body;

    if (!channel || !['evolution', 'meta-cloud'].includes(channel)) {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
    }

    
    const updateData: Record<string, any> = {
      isActive: isActive ?? false,
      updatedAt: new Date(),
    };

    if (channel === 'evolution') {
      if (apiUrl !== undefined) updateData.apiUrl = apiUrl || null;
      if (apiKey !== undefined) updateData.apiKey = apiKey || null;
      if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl || null;
      if (webhookToken !== undefined) updateData.webhookToken = webhookToken || null;
    }

    if (channel === 'meta-cloud') {
      if (metaAppId !== undefined) updateData.metaAppId = metaAppId || null;
      if (metaAppSecret !== undefined) updateData.metaAppSecret = metaAppSecret || null;
      if (metaConfigId !== undefined) updateData.metaConfigId = metaConfigId || null;
      if (metaWebhookToken !== undefined) updateData.metaWebhookToken = metaWebhookToken || null;
    }

    
    const existing = await db.select({ id: channelConfigs.id }).from(channelConfigs)
      .where(eq(channelConfigs.channel, channel)).limit(1);

    if (existing.length > 0) {
      await db.update(channelConfigs)
        .set(updateData)
        .where(eq(channelConfigs.channel, channel));
    } else {
      await db.insert(channelConfigs).values({
        channel,
        ...updateData,
      });
    }

    clearChannelConfigCache();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin Channels]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
