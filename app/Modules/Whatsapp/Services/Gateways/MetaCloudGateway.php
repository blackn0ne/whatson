<?php

namespace App\Modules\Whatsapp\Services\Gateways;

use App\Modules\Whatsapp\Contracts\WhatsappGatewayInterface;
use App\Modules\Whatsapp\Services\CloudApiClient;
use Illuminate\Http\Client\Response;

/**
 * Official WhatsApp Business Cloud API provider. Wraps CloudApiClient so the
 * rest of the app can talk to a provider-agnostic interface.
 */
class MetaCloudGateway implements WhatsappGatewayInterface
{
    public function __construct(private readonly CloudApiClient $client) {}

    public function provider(): string
    {
        return 'meta';
    }

    public function sendText(string $to, string $body): string
    {
        return $this->id($this->client->sendText($to, $body));
    }

    public function sendMedia(string $to, string $type, array $opts): string
    {
        return $this->id($this->client->sendMedia(
            $to,
            $type,
            $opts['media_id'] ?? '',
            $opts['caption'] ?? null,
            $opts['filename'] ?? null,
            $opts['link'] ?? null,
        ));
    }

    public function sendLocation(string $to, float $latitude, float $longitude, ?string $name = null, ?string $address = null): string
    {
        return $this->id($this->client->sendLocation($to, $latitude, $longitude, $name, $address));
    }

    public function sendTemplate(string $to, string $templateName, string $language, array $components = []): string
    {
        return $this->id($this->client->sendTemplate($to, $templateName, $language, $components));
    }

    public function sendInteractive(string $to, array $interactive): string
    {
        return $this->id($this->client->sendInteractive($to, $interactive));
    }

    public function verifyConnection(): bool
    {
        return true;
    }

    private function id(Response $resp): string
    {
        if (! $resp->successful()) {
            throw new \RuntimeException('WhatsApp send failed: '.$resp->body());
        }

        return (string) $resp->json('messages.0.id', '');
    }
}
