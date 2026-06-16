/**
 * WhatsApp Channel Configuration
 *
 * Reads channel credentials from DB first, falls back to env vars.
 * Admin can configure via /admin/channels page.
 */

import { db } from '@/lib/db/drizzle';
import { channelConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  webhookUrl: string;
  webhookToken: string;
  isActive: boolean;
}

export interface MetaCloudConfig {
  appId: string;
  appSecret: string;
  configId: string;
  webhookToken: string;
  isActive: boolean;
}

let _evoCache: { data: EvolutionConfig; ts: number } | null = null;
let _metaCache: { data: MetaCloudConfig; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function getEvolutionConfig(): Promise<EvolutionConfig> {
  if (_evoCache && Date.now() - _evoCache.ts < CACHE_TTL) {
    return _evoCache.data;
  }

  try {
    const [row] = await db.select().from(channelConfigs)
      .where(eq(channelConfigs.channel, 'evolution'))
      .limit(1);

    const config: EvolutionConfig = {
      apiUrl: row?.apiUrl || process.env.EVOLUTION_API_URL || 'http://localhost:8080',
      apiKey: row?.apiKey || process.env.AUTHENTICATION_API_KEY || '',
      webhookUrl: row?.webhookUrl || process.env.NEXT_PUBLIC_WEBHOOK_URL || '',
      webhookToken: row?.webhookToken || process.env.NEXT_PUBLIC_EVOLUTION_WEBHOOK_TOKEN || '',
      isActive: row?.isActive ?? true,
    };

    _evoCache = { data: config, ts: Date.now() };
    return config;
  } catch {
    return {
      apiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
      apiKey: process.env.AUTHENTICATION_API_KEY || '',
      webhookUrl: process.env.NEXT_PUBLIC_WEBHOOK_URL || '',
      webhookToken: process.env.NEXT_PUBLIC_EVOLUTION_WEBHOOK_TOKEN || '',
      isActive: true,
    };
  }
}

export async function getMetaCloudConfig(): Promise<MetaCloudConfig> {
  if (_metaCache && Date.now() - _metaCache.ts < CACHE_TTL) {
    return _metaCache.data;
  }

  try {
    const [row] = await db.select().from(channelConfigs)
      .where(eq(channelConfigs.channel, 'meta-cloud'))
      .limit(1);

    const config: MetaCloudConfig = {
      appId: row?.metaAppId || process.env.META_APP_ID || '',
      appSecret: row?.metaAppSecret || process.env.META_APP_SECRET || '',
      configId: row?.metaConfigId || process.env.NEXT_PUBLIC_META_CONFIG_ID || '',
      webhookToken: row?.metaWebhookToken || process.env.META_WEBHOOK_VERIFY_TOKEN || '',
      isActive: row?.isActive ?? false, 
    };

    _metaCache = { data: config, ts: Date.now() };
    return config;
  } catch {
    return {
      appId: process.env.META_APP_ID || '',
      appSecret: process.env.META_APP_SECRET || '',
      configId: process.env.NEXT_PUBLIC_META_CONFIG_ID || '',
      webhookToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
      isActive: false,
    };
  }
}

/**
 * Check if a channel is enabled. Used to gate instance creation.
 */
export async function isChannelActive(channel: 'evolution' | 'meta-cloud'): Promise<boolean> {
  if (channel === 'evolution') return (await getEvolutionConfig()).isActive;
  return (await getMetaCloudConfig()).isActive;
}

/**
 * Clear cache (called after admin saves config).
 */
export function clearChannelConfigCache(): void {
  _evoCache = null;
  _metaCache = null;
}
