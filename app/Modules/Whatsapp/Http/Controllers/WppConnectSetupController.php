<?php

namespace App\Modules\Whatsapp\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Shared\Models\ChannelAccount;
use App\Modules\Whatsapp\Services\WppConnectClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Connects a WhatsApp number through the unofficial WPPConnect Server by
 * scanning a QR code, and manages the lifecycle of that session.
 *
 * Each connected number is represented by a ChannelAccount:
 *   provider        = "wppconnect"
 *   phone_number_id = the WPPConnect session name
 *   webhook_token   = random secret used to route inbound webhooks
 *   credentials     = { session, token }
 */
class WppConnectSetupController extends Controller
{
    /**
     * POST /app/whatsapp/setup/wpp/start
     * Create a session and return the QR code to scan.
     */
    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'display_name' => ['nullable', 'string', 'max:128'],
        ]);

        if (! $this->serverConfigured()) {
            return response()->json(['message' => 'WPPConnect Server is not configured. Set WPPCONNECT_BASE_URL and WPPCONNECT_SECRET_KEY.'], 422);
        }

        $workspaceId = (int) ($request->user()->current_workspace_id ?? $request->user()->workspace_id);

        $session = 'ws'.$workspaceId.'_'.Str::lower(Str::random(10));
        $webhookToken = Str::random(48);

        $account = ChannelAccount::create([
            'workspace_id' => $workspaceId,
            'channel' => 'whatsapp',
            'provider' => 'wppconnect',
            'phone_number_id' => $session,
            'webhook_token' => $webhookToken,
            'display_name' => $validated['display_name'] ?? 'WhatsApp (unofficial)',
            'status' => 'inactive',
            'meta_json' => ['connected_via' => 'wppconnect'],
        ]);

        try {
            $client = WppConnectClient::forSession($session);
            $token = $client->generateToken();

            $account->credentials = ['session' => $session, 'token' => $token];
            $account->save();

            $webhookUrl = route('webhooks.whatsapp.wpp.receive', ['token' => $webhookToken]);
            $result = $client->startSession($webhookUrl);
        } catch (\Throwable $e) {
            $account->delete();
            Log::warning('wppconnect.start.failed', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Could not reach WPPConnect Server: '.$e->getMessage()], 422);
        }

        return response()->json([
            'channel_account_id' => $account->id,
            'status' => $result['status'] ?? 'INITIALIZING',
            'qrcode' => $result['qrcode'] ?? null,
        ]);
    }

    /**
     * GET /app/whatsapp/setup/wpp/{account}/status
     * Poll the session; refreshes QR while pairing and activates on connect.
     */
    public function status(Request $request, ChannelAccount $account): JsonResponse
    {
        $this->authorizeAccount($request, $account);

        $client = WppConnectClient::fromChannelAccount($account);
        $status = $client->statusSession();
        $state = strtoupper((string) ($status['status'] ?? 'UNKNOWN'));

        $qrcode = $status['qrcode'] ?? null;

        if ($state === 'CONNECTED') {
            if ($account->status !== 'active') {
                $account->update(['status' => 'active']);
            }
        } elseif (in_array($state, ['QRCODE', 'INITIALIZING', 'PAIRING'], true) && ! $qrcode) {
            // status-session may not carry the QR — re-issue start-session to fetch it.
            try {
                $webhookUrl = route('webhooks.whatsapp.wpp.receive', ['token' => $account->webhook_token]);
                $result = $client->startSession($webhookUrl);
                $qrcode = $result['qrcode'] ?? null;
                $state = strtoupper((string) ($result['status'] ?? $state));
                if ($state === 'CONNECTED' && $account->status !== 'active') {
                    $account->update(['status' => 'active']);
                }
            } catch (\Throwable $e) {
                Log::debug('wppconnect.status.qr_refresh_failed', ['error' => $e->getMessage()]);
            }
        }

        return response()->json([
            'status' => $state,
            'connected' => $state === 'CONNECTED',
            'qrcode' => $qrcode,
        ]);
    }

    /**
     * DELETE /app/whatsapp/setup/wpp/{account}
     * Log the number out and remove the channel account.
     */
    public function disconnect(Request $request, ChannelAccount $account): JsonResponse
    {
        $this->authorizeAccount($request, $account);

        try {
            $client = WppConnectClient::fromChannelAccount($account);
            $client->logoutSession();
            $client->closeSession();
        } catch (\Throwable $e) {
            Log::debug('wppconnect.disconnect.warning', ['error' => $e->getMessage()]);
        }

        $account->delete();

        return response()->json(['success' => true]);
    }

    private function serverConfigured(): bool
    {
        return (string) config('whatsapp.wppconnect.base_url') !== ''
            && (string) config('whatsapp.wppconnect.secret_key') !== '';
    }

    private function authorizeAccount(Request $request, ChannelAccount $account): void
    {
        $workspaceId = (int) ($request->user()->current_workspace_id ?? $request->user()->workspace_id);

        if ($account->workspace_id !== $workspaceId || $account->provider !== 'wppconnect') {
            abort(403);
        }
    }
}
