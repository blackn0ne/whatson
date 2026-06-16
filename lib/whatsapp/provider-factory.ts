

import type { WhatsAppProvider, WhatsAppInstanceConfig } from './types';
import { EvolutionProvider } from './providers/evolution';
import { isPluginInstalled } from '@/lib/plugins/registry';

export async function getWhatsAppProvider(instance: WhatsAppInstanceConfig): Promise<WhatsAppProvider> {
  if (instance.integration === 'META-CLOUD') {
    if (!isPluginInstalled('meta-cloud')) {
      throw new Error('Meta Cloud plugin is not installed. Cannot create provider for META-CLOUD instance.');
    }

    try {
      const { MetaCloudProvider } = await import('@/lib/plugins/meta-cloud/provider');
      return new MetaCloudProvider(instance);
    } catch (e) {
      throw new Error('Failed to load Meta Cloud provider. Ensure the plugin is properly installed.');
    }
  }

  
  return new EvolutionProvider(instance);
}

export function getWhatsAppProviderSync(instance: WhatsAppInstanceConfig): WhatsAppProvider {
  if (instance.integration === 'META-CLOUD') {
    throw new Error('META-CLOUD instances require async getWhatsAppProvider()');
  }
  return new EvolutionProvider(instance);
}
