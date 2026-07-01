<?php

namespace App\Modules\Whatsapp\Contracts;

/**
 * A WhatsApp delivery provider.
 *
 * Two implementations exist:
 *   - MetaCloudGateway  → official WhatsApp Business Cloud API
 *   - WppConnectGateway → unofficial self-hosted WPPConnect Server
 *
 * The provider is selected per ChannelAccount via its `provider` column so the
 * same inbox / campaign / API code paths transparently support both methods.
 */
interface WhatsappGatewayInterface
{
    /** Provider key: "meta" | "wppconnect". */
    public function provider(): string;

    /**
     * Send a plain text message.
     *
     * @param  string  $to  Recipient phone in E.164 (with or without leading +).
     * @return string  Provider message id.
     */
    public function sendText(string $to, string $body): string;

    /**
     * Send a media message (image / video / document / audio).
     *
     * @param  array{media_id?: string, link?: string, caption?: string, filename?: string}  $opts
     * @return string  Provider message id.
     */
    public function sendMedia(string $to, string $type, array $opts): string;

    /**
     * Send a location (map pin).
     *
     * @return string  Provider message id.
     */
    public function sendLocation(string $to, float $latitude, float $longitude, ?string $name = null, ?string $address = null): string;

    /**
     * Send a pre-approved template message.
     *
     * Only the official Meta provider supports true templates. Unofficial
     * providers fall back to sending the rendered body as plain text.
     *
     * @param  array<int, mixed>  $components
     * @return string  Provider message id.
     */
    public function sendTemplate(string $to, string $templateName, string $language, array $components = []): string;

    /**
     * Send an interactive (buttons / list) message. Unofficial providers fall
     * back to plain text where interactive messages are unsupported.
     *
     * @param  array<string, mixed>  $interactive
     * @return string  Provider message id.
     */
    public function sendInteractive(string $to, array $interactive): string;

    /** Verify that the underlying connection / credentials are valid. */
    public function verifyConnection(): bool;
}
