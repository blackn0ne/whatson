<?php

namespace App\Modules\Whatsapp\Http\Controllers;

use App\Http\Controllers\Concerns\FlushesWebhookResponse;
use App\Http\Controllers\Controller;
use App\Modules\Shared\Models\ChannelAccount;
use App\Modules\Whatsapp\Jobs\ProcessWppConnectInboundJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Receives webhook events from the self-hosted WPPConnect Server.
 *
 * WPPConnect cannot HMAC-sign its requests, so the endpoint is protected by a
 * random per-account token embedded in the URL, mapped to a ChannelAccount.
 */
class WppConnectWebhookController extends Controller
{
    use FlushesWebhookResponse;

    /** POST /webhooks/whatsapp/wpp/{token} */
    public function receive(Request $request, string $token): JsonResponse
    {
        $account = ChannelAccount::where('webhook_token', $token)
            ->where('channel', 'whatsapp')
            ->where('provider', 'wppconnect')
            ->first();

        if (! $account) {
            Log::warning('wppconnect.webhook.unknown_token', [
                'ip' => $request->ip(),
                'token_prefix' => substr($token, 0, 8).'…',
            ]);
            abort(403, 'Invalid webhook token');
        }

        $event = $request->all();

        // Sanity check: the session in the payload should match this account's session.
        $session = (string) ($event['session'] ?? '');
        if ($session !== '' && $account->phone_number_id && $session !== $account->phone_number_id) {
            Log::warning('wppconnect.webhook.session_mismatch', [
                'expected' => $account->phone_number_id,
                'received' => $session,
            ]);
        }

        return $this->flushWebhookOkThen(
            fn () => ProcessWppConnectInboundJob::dispatch($event, (int) $account->id)->onQueue('whatsapp')
        );
    }
}
