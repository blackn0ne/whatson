

import type {
  WhatsAppProvider,
  WhatsAppInstanceConfig,
  SendTextPayload,
  SendMediaPayload,
  SendAudioPayload,
  SendReactionPayload,
  SendInteractivePayload,
  SendTemplatePayload,
  SendResult,
  ConnectionStatus,
} from '../types';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';

function cleanNumber(remoteJid: string): string {
  return remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace(/\D/g, '');
}

function buildQuoted(quoted?: { id: string; text?: string }) {
  if (!quoted) return undefined;
  return {
    key: { id: quoted.id },
    message: quoted.text ? { conversation: quoted.text } : undefined,
  };
}

export class EvolutionProvider implements WhatsAppProvider {
  readonly providerType = 'evolution';
  private instanceName: string;
  private accessToken: string;

  constructor(config: WhatsAppInstanceConfig) {
    this.instanceName = config.instanceName;
    this.accessToken = config.accessToken;
  }

  private async request(endpoint: string, body: any): Promise<{ ok: boolean; data: any }> {
    const response = await fetch(`${EVOLUTION_API_URL}/message/${endpoint}/${this.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.accessToken,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    let data: any;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: `Non-JSON response (${response.status}): ${text.substring(0, 200)}` };
    }

    return { ok: response.ok, data };
  }

  private parseResult(res: { ok: boolean; data: any }): SendResult {
    if (res.ok && res.data?.key?.id) {
      return { success: true, messageId: res.data.key.id, raw: res.data };
    }
    return {
      success: false,
      error: res.data?.message || res.data?.error || 'Unknown Evolution API error',
      raw: res.data,
    };
  }

  async sendText(remoteJid: string, payload: SendTextPayload): Promise<SendResult> {
    const body: any = {
      number: cleanNumber(remoteJid),
      text: payload.text,
      linkPreview: true,
    };
    if (payload.quoted) body.quoted = buildQuoted(payload.quoted);

    return this.parseResult(await this.request('sendText', body));
  }

  async sendMedia(remoteJid: string, payload: SendMediaPayload): Promise<SendResult> {
    const body: any = {
      number: cleanNumber(remoteJid),
      delay: 1200,
      mediatype: payload.mediaType,
      media: payload.mediaBase64,
      mimetype: payload.mimetype,
    };
    if (payload.caption) body.caption = payload.caption;
    if (payload.mediaType === 'document' && payload.fileName) body.fileName = payload.fileName;
    if (payload.quoted) body.quoted = buildQuoted(payload.quoted);

    return this.parseResult(await this.request('sendMedia', body));
  }

  async sendAudio(remoteJid: string, payload: SendAudioPayload): Promise<SendResult> {
    const body: any = {
      number: cleanNumber(remoteJid),
      delay: 1200,
      presence: 'recording',
      audio: payload.audioBase64,
      mimetype: payload.mimetype || 'audio/mpeg',
      ptt: payload.ptt ?? true,
    };
    if (payload.quoted) body.quoted = buildQuoted(payload.quoted);

    return this.parseResult(await this.request('sendWhatsAppAudio', body));
  }

  async sendReaction(remoteJid: string, payload: SendReactionPayload): Promise<SendResult> {
    const body = {
      key: {
        remoteJid,
        fromMe: payload.fromMe,
        id: payload.messageId,
      },
      reaction: payload.emoji || '',
    };

    const res = await this.request('sendReaction', body);
    return { success: res.ok, raw: res.data };
  }

  async sendInteractive(remoteJid: string, payload: SendInteractivePayload): Promise<SendResult> {
    
    
    
    return { success: false, error: 'Interactive messages not supported via Evolution provider' };
  }

  async sendTemplate(remoteJid: string, payload: SendTemplatePayload): Promise<SendResult> {
    
    return { success: false, error: 'Template messages not supported via Evolution provider' };
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      const response = await fetch(
        `${EVOLUTION_API_URL}/instance/connectionState/${this.instanceName}`,
        {
          headers: { 'apikey': this.accessToken },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) return 'unknown';
      const data = await response.json();
      const state = data?.instance?.state || data?.state;

      if (state === 'open') return 'open';
      if (state === 'close') return 'close';
      if (state === 'connecting') return 'connecting';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async disconnect(): Promise<void> {
    await fetch(`${EVOLUTION_API_URL}/instance/logout/${this.instanceName}`, {
      method: 'DELETE',
      headers: { 'apikey': this.accessToken },
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
}
