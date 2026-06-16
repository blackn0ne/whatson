

export interface SendTextPayload {
  text: string;
  quoted?: { id: string; text?: string };
}

export interface SendMediaPayload {
  mediaBase64: string;
  mimetype: string;
  mediaType: 'image' | 'video' | 'document';
  fileName?: string;
  caption?: string;
  quoted?: { id: string; text?: string };
}

export interface SendAudioPayload {
  audioBase64: string;
  mimetype?: string;
  ptt?: boolean;
  quoted?: { id: string; text?: string };
}

export interface SendReactionPayload {
  messageId: string;
  emoji: string;
  fromMe: boolean;
}

export interface SendInteractivePayload {
  type: 'button' | 'list';
  body: { text: string };
  header?: { type: string; text?: string };
  footer?: { text: string };
  action: Record<string, any>;
}

export interface SendTemplatePayload {
  templateName: string;
  language: string;
  components?: Record<string, any>[];
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: any;
}

export type ConnectionStatus = 'open' | 'close' | 'connecting' | 'unknown';

export interface WhatsAppInstanceConfig {
  id: number;
  instanceName: string;
  accessToken: string;
  integration: string;
  metaToken?: string | null;
  metaPhoneNumberId?: string | null;
  metaBusinessId?: string | null;
}

export interface WhatsAppProvider {
  readonly providerType: string;

  sendText(remoteJid: string, payload: SendTextPayload): Promise<SendResult>;
  sendMedia(remoteJid: string, payload: SendMediaPayload): Promise<SendResult>;
  sendAudio(remoteJid: string, payload: SendAudioPayload): Promise<SendResult>;
  sendReaction(remoteJid: string, payload: SendReactionPayload): Promise<SendResult>;
  sendInteractive(remoteJid: string, payload: SendInteractivePayload): Promise<SendResult>;
  sendTemplate(remoteJid: string, payload: SendTemplatePayload): Promise<SendResult>;
  getConnectionStatus(): Promise<ConnectionStatus>;
  disconnect(): Promise<void>;
}
