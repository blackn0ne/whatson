import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetaCloudProvider } from '../../plugins/meta-cloud/provider';
import type { WhatsAppInstanceConfig } from '../types';

const mockConfig: WhatsAppInstanceConfig = {
  id: 2,
  instanceName: 'meta-instance',
  accessToken: 'evo-token',
  integration: 'META-CLOUD',
  metaToken: 'EAAxxxxxxx',
  metaPhoneNumberId: '123456789',
  metaBusinessId: 'biz-001',
};

const GRAPH_URL = 'https://graph.facebook.com/v21.0/123456789/messages';

describe('MetaCloudProvider', () => {
  let provider: MetaCloudProvider;

  beforeEach(() => {
    provider = new MetaCloudProvider(mockConfig);
    vi.restoreAllMocks();
  });

  it('should have providerType "meta-cloud"', () => {
    expect(provider.providerType).toBe('meta-cloud');
  });

  it('should throw if metaToken is missing', () => {
    expect(() => new MetaCloudProvider({ ...mockConfig, metaToken: null })).toThrow(
      'metaToken and metaPhoneNumberId'
    );
  });

  it('should throw if metaPhoneNumberId is missing', () => {
    expect(() => new MetaCloudProvider({ ...mockConfig, metaPhoneNumberId: null })).toThrow(
      'metaToken and metaPhoneNumberId'
    );
  });

  describe('sendText', () => {
    it('should send text via Graph API', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ messages: [{ id: 'wamid.abc123' }] }),
      } as Response);

      const result = await provider.sendText('5511999990000@s.whatsapp.net', {
        text: 'Hello from Meta',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.abc123');

      const call = vi.mocked(fetch).mock.calls[0];
      expect(call[0]).toBe(GRAPH_URL);

      const body = JSON.parse(call[1]!.body as string);
      expect(body.messaging_product).toBe('whatsapp');
      expect(body.to).toBe('5511999990000');
      expect(body.type).toBe('text');
      expect(body.text.body).toBe('Hello from Meta');
      expect(body.text.preview_url).toBe(true);
    });

    it('should include context for quoted messages', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.reply1' }] }),
      } as Response);

      await provider.sendText('5511999990000@s.whatsapp.net', {
        text: 'Reply',
        quoted: { id: 'wamid.original' },
      });

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.context.message_id).toBe('wamid.original');
    });

    it('should handle rate limiting (429)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit hit' } }),
      } as Response);

      const result = await provider.sendText('5511999990000@s.whatsapp.net', { text: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limited');
    });

    it('should handle API errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid phone number' } }),
      } as Response);

      const result = await provider.sendText('invalid@s.whatsapp.net', { text: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number');
    });
  });

  describe('sendMedia', () => {
    it('should upload media then send message', async () => {
      
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'media-upload-id-1' }),
        } as Response)
        
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [{ id: 'wamid.media1' }] }),
        } as Response);

      const result = await provider.sendMedia('5511999990000@s.whatsapp.net', {
        mediaBase64: 'aW1hZ2VkYXRh',
        mimetype: 'image/jpeg',
        mediaType: 'image',
        caption: 'My photo',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.media1');

      
      const uploadCall = vi.mocked(fetch).mock.calls[0];
      expect(uploadCall[0]).toContain('/media');

      
      const sendBody = JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string);
      expect(sendBody.type).toBe('image');
      expect(sendBody.image.id).toBe('media-upload-id-1');
      expect(sendBody.image.caption).toBe('My photo');
    });

    it('should return error if upload fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Upload failed' } }),
      } as Response);

      const result = await provider.sendMedia('5511999990000@s.whatsapp.net', {
        mediaBase64: 'data',
        mimetype: 'image/png',
        mediaType: 'image',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to upload media');
    });

    it('should include filename for documents', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'doc-upload-1' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [{ id: 'wamid.doc1' }] }),
        } as Response);

      await provider.sendMedia('5511999990000@s.whatsapp.net', {
        mediaBase64: 'cGRm',
        mimetype: 'application/pdf',
        mediaType: 'document',
        fileName: 'report.pdf',
      });

      const sendBody = JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string);
      expect(sendBody.type).toBe('document');
      expect(sendBody.document.filename).toBe('report.pdf');
    });
  });

  describe('sendReaction', () => {
    it('should send reaction via Graph API', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.react1' }] }),
      } as Response);

      const result = await provider.sendReaction('5511999990000@s.whatsapp.net', {
        messageId: 'wamid.target',
        emoji: '❤️',
        fromMe: false,
      });

      expect(result.success).toBe(true);

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.type).toBe('reaction');
      expect(body.reaction.message_id).toBe('wamid.target');
      expect(body.reaction.emoji).toBe('❤️');
    });
  });

  describe('sendInteractive', () => {
    it('should send interactive message (buttons)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.interactive1' }] }),
      } as Response);

      const result = await provider.sendInteractive('5511999990000@s.whatsapp.net', {
        type: 'button',
        body: { text: 'Choose an option' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: '1', title: 'Option A' } },
            { type: 'reply', reply: { id: '2', title: 'Option B' } },
          ],
        },
      });

      expect(result.success).toBe(true);

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.type).toBe('interactive');
      expect(body.interactive.type).toBe('button');
      expect(body.interactive.body.text).toBe('Choose an option');
    });
  });

  describe('sendTemplate', () => {
    it('should send template via Graph API', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.tpl1' }] }),
      } as Response);

      const result = await provider.sendTemplate('5511999990000@s.whatsapp.net', {
        templateName: 'hello_world',
        language: 'pt_BR',
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'John' }] }],
      });

      expect(result.success).toBe(true);

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.type).toBe('template');
      expect(body.template.name).toBe('hello_world');
      expect(body.template.language.code).toBe('pt_BR');
    });
  });

  describe('getConnectionStatus', () => {
    it('should return "open" when API responds OK', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verified_name: 'Test Business' }),
      } as Response);

      expect(await provider.getConnectionStatus()).toBe('open');
    });

    it('should return "close" on 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Unauthorized' } }),
      } as Response);

      expect(await provider.getConnectionStatus()).toBe('close');
    });

    it('should return "unknown" on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('timeout'));

      expect(await provider.getConnectionStatus()).toBe('unknown');
    });
  });

  describe('auth headers', () => {
    it('should send Bearer token on every request', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.x' }] }),
      } as Response);

      await provider.sendText('5511999990000@s.whatsapp.net', { text: 'test' });

      const headers = vi.mocked(fetch).mock.calls[0][1]!.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer EAAxxxxxxx');
    });
  });
});
