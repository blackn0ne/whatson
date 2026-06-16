import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionProvider } from '../providers/evolution';
import type { WhatsAppInstanceConfig } from '../types';

const mockConfig: WhatsAppInstanceConfig = {
  id: 1,
  instanceName: 'test-instance',
  accessToken: 'test-token-123',
  integration: 'WHATSAPP-BAILEYS',
};

const EVOLUTION_URL = 'http://localhost:8080';

describe('EvolutionProvider', () => {
  let provider: EvolutionProvider;

  beforeEach(() => {
    provider = new EvolutionProvider(mockConfig);
    vi.restoreAllMocks();
  });

  it('should have providerType "evolution"', () => {
    expect(provider.providerType).toBe('evolution');
  });

  describe('sendText', () => {
    it('should send text message and return messageId on success', async () => {
      const mockResponse = { key: { id: 'msg-123' }, message: { conversation: 'Hello' } };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      } as Response);

      const result = await provider.sendText('5511999990000@s.whatsapp.net', {
        text: 'Hello World',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');

      const call = vi.mocked(fetch).mock.calls[0];
      expect(call[0]).toBe(`${EVOLUTION_URL}/message/sendText/test-instance`);

      const body = JSON.parse(call[1]!.body as string);
      expect(body.number).toBe('5511999990000');
      expect(body.text).toBe('Hello World');
      expect(body.linkPreview).toBe(true);
    });

    it('should strip non-digits from remoteJid', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ key: { id: 'msg-456' } }),
      } as Response);

      await provider.sendText('5511999990000@s.whatsapp.net', { text: 'test' });

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.number).toBe('5511999990000');
    });

    it('should include quoted message when provided', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ key: { id: 'msg-789' } }),
      } as Response);

      await provider.sendText('5511999990000@s.whatsapp.net', {
        text: 'Reply',
        quoted: { id: 'original-msg-id', text: 'Original text' },
      });

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.quoted.key.id).toBe('original-msg-id');
      expect(body.quoted.message.conversation).toBe('Original text');
    });

    it('should return error on API failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ message: 'Instance not connected' }),
      } as Response);

      const result = await provider.sendText('5511999990000@s.whatsapp.net', { text: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not connected');
    });

    it('should handle non-JSON response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '<html>Bad Gateway</html>',
      } as Response);

      const result = await provider.sendText('5511999990000@s.whatsapp.net', { text: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Non-JSON response');
    });
  });

  describe('sendMedia', () => {
    it('should send image with correct payload', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ key: { id: 'media-1' } }),
      } as Response);

      const result = await provider.sendMedia('5511999990000@s.whatsapp.net', {
        mediaBase64: 'base64data==',
        mimetype: 'image/jpeg',
        mediaType: 'image',
        caption: 'Photo',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('media-1');

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.mediatype).toBe('image');
      expect(body.media).toBe('base64data==');
      expect(body.mimetype).toBe('image/jpeg');
      expect(body.caption).toBe('Photo');
    });

    it('should include fileName for documents', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ key: { id: 'doc-1' } }),
      } as Response);

      await provider.sendMedia('5511999990000@s.whatsapp.net', {
        mediaBase64: 'base64data==',
        mimetype: 'application/pdf',
        mediaType: 'document',
        fileName: 'report.pdf',
      });

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.fileName).toBe('report.pdf');
      expect(body.mediatype).toBe('document');
    });
  });

  describe('sendAudio', () => {
    it('should send audio with ptt flag', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ key: { id: 'audio-1' } }),
      } as Response);

      const result = await provider.sendAudio('5511999990000@s.whatsapp.net', {
        audioBase64: 'audiobase64==',
      });

      expect(result.success).toBe(true);

      const call = vi.mocked(fetch).mock.calls[0];
      expect(call[0]).toContain('/message/sendWhatsAppAudio/');

      const body = JSON.parse(call[1]!.body as string);
      expect(body.ptt).toBe(true);
      expect(body.mimetype).toBe('audio/mpeg');
      expect(body.presence).toBe('recording');
    });
  });

  describe('sendReaction', () => {
    it('should send reaction with correct key structure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ status: 'PENDING' }),
      } as Response);

      const result = await provider.sendReaction('5511999990000@s.whatsapp.net', {
        messageId: 'msg-to-react',
        emoji: '👍',
        fromMe: false,
      });

      expect(result.success).toBe(true);

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.key.remoteJid).toBe('5511999990000@s.whatsapp.net');
      expect(body.key.id).toBe('msg-to-react');
      expect(body.key.fromMe).toBe(false);
      expect(body.reaction).toBe('👍');
    });
  });

  describe('sendInteractive', () => {
    it('should return error (not supported via Evolution)', async () => {
      const result = await provider.sendInteractive('5511999990000@s.whatsapp.net', {
        type: 'button',
        body: { text: 'Choose' },
        action: { buttons: [] },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });
  });

  describe('getConnectionStatus', () => {
    it('should return "open" when connected', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ instance: { state: 'open' } }),
      } as Response);

      const status = await provider.getConnectionStatus();
      expect(status).toBe('open');
    });

    it('should return "unknown" on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const status = await provider.getConnectionStatus();
      expect(status).toBe('unknown');
    });
  });

  describe('auth headers', () => {
    it('should send apikey header on every request', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ key: { id: 'x' } }),
      } as Response);

      await provider.sendText('5511999990000@s.whatsapp.net', { text: 'test' });

      const headers = vi.mocked(fetch).mock.calls[0][1]!.headers as Record<string, string>;
      expect(headers.apikey).toBe('test-token-123');
    });
  });
});
