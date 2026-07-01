<?php

namespace App\Modules\Whatsapp\Services;

use App\Modules\Shared\Models\ChannelAccount;
use App\Modules\Shared\Models\Conversation;
use App\Modules\Whatsapp\Contracts\WhatsappGatewayInterface;
use App\Modules\Whatsapp\Services\Gateways\MetaCloudGateway;
use App\Modules\Whatsapp\Services\Gateways\WppConnectGateway;

/**
 * Resolves the correct WhatsApp provider (official Meta vs unofficial
 * WPPConnect) for a given channel account / conversation / workspace.
 *
 * The `provider` column on ChannelAccount is the single source of truth:
 *   - "wppconnect" → WppConnectGateway
 *   - anything else (default "meta") → MetaCloudGateway
 */
class WhatsappGatewayManager
{
    public function forChannelAccount(ChannelAccount $account): WhatsappGatewayInterface
    {
        if ($account->isUnofficial()) {
            return new WppConnectGateway(WppConnectClient::fromChannelAccount($account));
        }

        $client = CloudApiClient::forPhoneNumber((string) $account->phone_number_id, (int) $account->workspace_id)
            ?? CloudApiClient::forWorkspace((int) $account->workspace_id);

        if (! $client) {
            throw new \RuntimeException('No active WhatsApp Cloud API credentials for this account.');
        }

        return new MetaCloudGateway($client);
    }

    public function forConversation(Conversation $conversation): WhatsappGatewayInterface
    {
        $account = $conversation->channelAccount;
        if ($account) {
            return $this->forChannelAccount($account);
        }

        return $this->forWorkspace((int) $conversation->workspace_id);
    }

    public function forWorkspace(int $workspaceId): WhatsappGatewayInterface
    {
        $account = ChannelAccount::where('workspace_id', $workspaceId)
            ->where('channel', 'whatsapp')
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByRaw("CASE WHEN provider = 'meta' THEN 0 ELSE 1 END")
            ->orderBy('id')
            ->first();

        if ($account) {
            return $this->forChannelAccount($account);
        }

        // Legacy path: a WABA exists but no ChannelAccount row.
        $client = CloudApiClient::forWorkspace($workspaceId);
        if ($client) {
            return new MetaCloudGateway($client);
        }

        throw new \RuntimeException('No WhatsApp account configured for workspace '.$workspaceId);
    }
}
