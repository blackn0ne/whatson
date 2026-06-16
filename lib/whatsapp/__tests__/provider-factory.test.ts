import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWhatsAppProvider, getWhatsAppProviderSync } from '../provider-factory';
import { EvolutionProvider } from '../providers/evolution';
import type { WhatsAppInstanceConfig } from '../types';

vi.mock('@/lib/plugins/registry', () => ({
  isPluginInstalled: vi.fn(),
}));

import { isPluginInstalled } from '@/lib/plugins/registry';

const evolutionConfig: WhatsAppInstanceConfig = {
  id: 1,
  instanceName: 'evo-instance',
  accessToken: 'token-123',
  integration: 'WHATSAPP-BAILEYS',
};

const wabaEvolutionConfig: WhatsAppInstanceConfig = {
  id: 2,
  instanceName: 'waba-evo',
  accessToken: 'token-456',
  integration: 'WHATSAPP-BUSINESS',
  metaToken: 'EAA-token',
  metaPhoneNumberId: '12345',
};

const metaCloudConfig: WhatsAppInstanceConfig = {
  id: 3,
  instanceName: 'meta-direct',
  accessToken: '',
  integration: 'META-CLOUD',
  metaToken: 'EAA-direct-token',
  metaPhoneNumberId: '67890',
  metaBusinessId: 'biz-002',
};

describe('Provider Factory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getWhatsAppProvider (async)', () => {
    it('should return EvolutionProvider for WHATSAPP-BAILEYS', async () => {
      const provider = await getWhatsAppProvider(evolutionConfig);
      expect(provider).toBeInstanceOf(EvolutionProvider);
      expect(provider.providerType).toBe('evolution');
    });

    it('should return EvolutionProvider for WHATSAPP-BUSINESS', async () => {
      const provider = await getWhatsAppProvider(wabaEvolutionConfig);
      expect(provider).toBeInstanceOf(EvolutionProvider);
      expect(provider.providerType).toBe('evolution');
    });

    it('should return MetaCloudProvider for META-CLOUD when plugin is installed', async () => {
      vi.mocked(isPluginInstalled).mockReturnValue(true);

      const provider = await getWhatsAppProvider(metaCloudConfig);
      expect(provider.providerType).toBe('meta-cloud');
    });

    it('should throw when META-CLOUD plugin is not installed', async () => {
      vi.mocked(isPluginInstalled).mockReturnValue(false);

      await expect(getWhatsAppProvider(metaCloudConfig)).rejects.toThrow(
        'Meta Cloud plugin is not installed'
      );
    });
  });

  describe('getWhatsAppProviderSync', () => {
    it('should return EvolutionProvider for Baileys', () => {
      const provider = getWhatsAppProviderSync(evolutionConfig);
      expect(provider).toBeInstanceOf(EvolutionProvider);
    });

    it('should return EvolutionProvider for WHATSAPP-BUSINESS', () => {
      const provider = getWhatsAppProviderSync(wabaEvolutionConfig);
      expect(provider).toBeInstanceOf(EvolutionProvider);
    });

    it('should throw for META-CLOUD (requires async)', () => {
      expect(() => getWhatsAppProviderSync(metaCloudConfig)).toThrow(
        'META-CLOUD instances require async'
      );
    });
  });
});
