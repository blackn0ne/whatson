<?php

namespace App\Modules\Whatsapp\Services\Gateways;

use App\Modules\Whatsapp\Contracts\WhatsappGatewayInterface;
use App\Modules\Whatsapp\Services\WppConnectClient;
use Illuminate\Support\Facades\Http;

/**
 * Unofficial WhatsApp provider driven by a self-hosted WPPConnect Server.
 *
 * WhatsApp Web (the protocol behind WPPConnect) has no concept of pre-approved
 * templates or native interactive buttons for arbitrary numbers, so those calls
 * gracefully degrade to plain text. Media is sent as a base64 data URL, which we
 * build from a public link when one is available.
 */
class WppConnectGateway implements WhatsappGatewayInterface
{
    public function __construct(private readonly WppConnectClient $client) {}

    public function provider(): string
    {
        return 'wppconnect';
    }

    public function sendText(string $to, string $body): string
    {
        return $this->client->sendText($to, $body);
    }

    public function sendMedia(string $to, string $type, array $opts): string
    {
        $link = (string) ($opts['link'] ?? '');
        if ($link === '') {
            throw new \RuntimeException('Unofficial WhatsApp can only send media by public URL (no Meta media id).');
        }

        return $this->client->sendFileBase64(
            $to,
            $this->urlToDataUrl($link),
            $opts['filename'] ?? null,
            $opts['caption'] ?? null,
        );
    }

    public function sendLocation(string $to, float $latitude, float $longitude, ?string $name = null, ?string $address = null): string
    {
        $title = trim(implode(' - ', array_filter([$name, $address]))) ?: null;

        return $this->client->sendLocation($to, $latitude, $longitude, $title);
    }

    public function sendTemplate(string $to, string $templateName, string $language, array $components = []): string
    {
        // No real templates on the unofficial channel — send the rendered body text.
        $text = $this->componentsToText($components);

        return $this->client->sendText($to, $text !== '' ? $text : $templateName);
    }

    public function sendInteractive(string $to, array $interactive): string
    {
        // Flatten an interactive payload (body + buttons/list) to readable text.
        return $this->client->sendText($to, $this->interactiveToText($interactive));
    }

    public function verifyConnection(): bool
    {
        return $this->client->isConnected();
    }

    /** Download a public URL and return a base64 data URL for send-file-base64. */
    private function urlToDataUrl(string $url): string
    {
        $verify = (bool) config('whatsapp.wppconnect.verify_ssl', true);
        $req = Http::timeout((int) config('whatsapp.wppconnect.timeout', 30));
        if (! $verify) {
            $req = $req->withoutVerifying();
        }

        $resp = $req->get($url);
        if (! $resp->successful()) {
            throw new \RuntimeException("Could not download media (HTTP {$resp->status()}) from {$url}");
        }

        $mime = trim(explode(';', (string) ($resp->header('Content-Type') ?: 'application/octet-stream'))[0]);

        return 'data:'.$mime.';base64,'.base64_encode($resp->body());
    }

    /**
     * Extract readable text from Meta-shape template components (BODY params).
     *
     * @param  array<int, mixed>  $components
     */
    private function componentsToText(array $components): string
    {
        $parts = [];
        foreach ($components as $component) {
            if (! is_array($component)) {
                continue;
            }
            foreach ((array) ($component['parameters'] ?? []) as $param) {
                if (is_array($param) && isset($param['text']) && is_string($param['text'])) {
                    $parts[] = $param['text'];
                }
            }
        }

        return trim(implode("\n", $parts));
    }

    /**
     * Flatten an interactive message to text: body + numbered buttons / rows.
     *
     * @param  array<string, mixed>  $interactive
     */
    private function interactiveToText(array $interactive): string
    {
        $lines = [];

        $body = $interactive['body']['text'] ?? null;
        if (is_string($body) && $body !== '') {
            $lines[] = $body;
        }

        $action = $interactive['action'] ?? [];
        foreach ((array) ($action['buttons'] ?? []) as $i => $button) {
            $title = $button['reply']['title'] ?? ($button['title'] ?? null);
            if (is_string($title)) {
                $lines[] = ($i + 1).'. '.$title;
            }
        }
        foreach ((array) ($action['sections'] ?? []) as $section) {
            foreach ((array) ($section['rows'] ?? []) as $row) {
                if (isset($row['title']) && is_string($row['title'])) {
                    $lines[] = '• '.$row['title'];
                }
            }
        }

        return trim(implode("\n", $lines)) ?: '—';
    }
}
