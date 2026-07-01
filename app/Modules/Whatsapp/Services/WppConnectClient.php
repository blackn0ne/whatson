<?php

namespace App\Modules\Whatsapp\Services;

use App\Modules\Shared\Models\ChannelAccount;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin HTTP client for a self-hosted WPPConnect Server instance.
 *
 * One WPPConnect "session" maps to one connected WhatsApp number, which we store
 * as a ChannelAccount (provider = "wppconnect", phone_number_id = session name,
 * credentials.token = the session bearer token).
 *
 * Docs: https://wppconnect-team.github.io/swagger/wppconnect-server/
 */
class WppConnectClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $session,
        private readonly string $secretKey,
        private string $token = '',
        private readonly int $timeout = 30,
        private readonly bool $verifySsl = true,
    ) {}

    /** Build a client for an existing unofficial ChannelAccount (session + token from DB). */
    public static function fromChannelAccount(ChannelAccount $account): self
    {
        $creds = $account->credentials ?? [];

        return new self(
            baseUrl: (string) config('whatsapp.wppconnect.base_url'),
            session: (string) ($account->phone_number_id ?? ($creds['session'] ?? '')),
            secretKey: (string) config('whatsapp.wppconnect.secret_key'),
            token: (string) ($creds['token'] ?? ''),
            timeout: (int) config('whatsapp.wppconnect.timeout', 30),
            verifySsl: (bool) config('whatsapp.wppconnect.verify_ssl', true),
        );
    }

    /** Build a client for a brand-new session name (used during connect / QR). */
    public static function forSession(string $session, string $token = ''): self
    {
        return new self(
            baseUrl: (string) config('whatsapp.wppconnect.base_url'),
            session: $session,
            secretKey: (string) config('whatsapp.wppconnect.secret_key'),
            token: $token,
            timeout: (int) config('whatsapp.wppconnect.timeout', 30),
            verifySsl: (bool) config('whatsapp.wppconnect.verify_ssl', true),
        );
    }

    public function session(): string
    {
        return $this->session;
    }

    public function token(): string
    {
        return $this->token;
    }

    /**
     * Mint a bearer token for this session using the server SECRET_KEY.
     * Must be called before start-session. Caches the token on the instance.
     */
    public function generateToken(): string
    {
        $resp = $this->http(auth: false)
            ->post($this->url("/{$this->secretKey}/generate-token"));

        if (! $resp->successful()) {
            throw new \RuntimeException('WPPConnect generate-token failed: '.$resp->body());
        }

        $token = (string) $resp->json('token', '');
        if ($token === '') {
            throw new \RuntimeException('WPPConnect generate-token returned no token: '.$resp->body());
        }

        return $this->token = $token;
    }

    /**
     * Start (or resume) the WhatsApp session.
     *
     * With `$waitQrCode = false` (default) the call returns quickly after kicking
     * off Chromium — poll {@see statusSession()} for the QR. Setting wait to true
     * blocks until the QR is ready and can exceed 60s on a slow VPS.
     *
     * @return array<string, mixed>
     */
    public function startSession(?string $webhookUrl = null, bool $waitQrCode = false): array
    {
        $timeout = $waitQrCode
            ? (int) config('whatsapp.wppconnect.start_timeout', 120)
            : $this->timeout;

        $resp = $this->http(timeout: $timeout)->post($this->url('/start-session'), array_filter([
            'webhook' => $webhookUrl,
            'waitQrCode' => $waitQrCode,
        ], fn ($v) => $v !== null));

        if (! $resp->successful()) {
            throw new \RuntimeException('WPPConnect start-session failed: '.$resp->body());
        }

        return $resp->json() ?? [];
    }

    /**
     * Current session status. Returns e.g. CONNECTED, QRCODE, CLOSED,
     * INITIALIZING, DISCONNECTED, PAIRING. Includes `qrcode` while pairing.
     *
     * @return array<string, mixed>
     */
    public function statusSession(): array
    {
        $resp = $this->http()->get($this->url('/status-session'));

        return $resp->successful() ? ($resp->json() ?? []) : ['status' => 'ERROR', 'error' => $resp->body()];
    }

    /** Whether the underlying WhatsApp Web session is currently connected. */
    public function isConnected(): bool
    {
        return strtoupper((string) ($this->statusSession()['status'] ?? '')) === 'CONNECTED';
    }

    /** Log the number out of WhatsApp (requires a fresh QR scan to reconnect). */
    public function logoutSession(): void
    {
        $this->http()->post($this->url('/logout-session'));
    }

    /** Close the session process on the server (keeps the auth to resume later). */
    public function closeSession(): void
    {
        $this->http()->post($this->url('/close-session'));
    }

    /** Send a plain text message. Returns the WhatsApp message id. */
    public function sendText(string $to, string $body): string
    {
        $resp = $this->http()->post($this->url('/send-message'), [
            'phone' => $this->normalizePhone($to),
            'message' => $body,
            'isGroup' => false,
        ]);

        return $this->extractMessageId($resp, 'send-message');
    }

    /**
     * Send a media file encoded as a base64 data URL. Returns the message id.
     * `$base64` must be a full data URL, e.g. "data:image/png;base64,....".
     */
    public function sendFileBase64(string $to, string $base64, ?string $filename = null, ?string $caption = null): string
    {
        $resp = $this->http()->post($this->url('/send-file-base64'), array_filter([
            'phone' => $this->normalizePhone($to),
            'base64' => $base64,
            'filename' => $filename,
            'message' => $caption,
            'isGroup' => false,
        ], fn ($v) => $v !== null && $v !== ''));

        return $this->extractMessageId($resp, 'send-file-base64');
    }

    /** Send a location pin. Returns the message id. */
    public function sendLocation(string $to, float $latitude, float $longitude, ?string $title = null): string
    {
        $resp = $this->http()->post($this->url('/send-location'), array_filter([
            'phone' => $this->normalizePhone($to),
            'lat' => (string) $latitude,
            'lng' => (string) $longitude,
            'title' => $title,
            'isGroup' => false,
        ], fn ($v) => $v !== null && $v !== ''));

        return $this->extractMessageId($resp, 'send-location');
    }

    /** Strip the "+" and any non-digits — WPPConnect expects a bare MSISDN. */
    private function normalizePhone(string $phone): string
    {
        return preg_replace('/\D+/', '', $phone) ?? $phone;
    }

    /**
     * WPPConnect returns the sent message under `response` (array or object).
     * The id can be a plain string or an object with `_serialized`.
     */
    private function extractMessageId(Response $resp, string $op): string
    {
        if (! $resp->successful()) {
            throw new \RuntimeException("WPPConnect {$op} failed: ".$resp->body());
        }

        $response = $resp->json('response');
        $first = is_array($response) && array_is_list($response) ? ($response[0] ?? null) : $response;

        $id = is_array($first) ? ($first['id'] ?? null) : null;
        if (is_array($id)) {
            $id = $id['_serialized'] ?? ($id['id'] ?? null);
        }
        $id ??= $resp->json('id');

        if (! is_string($id) || $id === '') {
            Log::warning('wppconnect.send.no_message_id', ['op' => $op, 'body' => $resp->json()]);

            return '';
        }

        return $id;
    }

    private function http(bool $auth = true, ?int $timeout = null): PendingRequest
    {
        $req = Http::timeout($timeout ?? $this->timeout)
            ->acceptJson()
            ->asJson();

        if (! $this->verifySsl) {
            $req = $req->withoutVerifying();
        }

        if ($auth && $this->token !== '') {
            $req = $req->withToken($this->token);
        }

        return $req;
    }

    private function url(string $path): string
    {
        return $this->baseUrl.'/api/'.rawurlencode($this->session).$path;
    }
}
