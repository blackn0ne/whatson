<?php

namespace App\Modules\Whatsapp\Jobs;

use App\Modules\Shared\Models\ChannelAccount;
use App\Modules\Whatsapp\Services\WhatsappDriver;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Processes a single WPPConnect Server webhook event (inbound message / ack)
 * off the request cycle, mirroring ProcessInboundMessageJob for the Meta path.
 */
class ProcessWppConnectInboundJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    /**
     * @param  array<string, mixed>  $event
     */
    public function __construct(
        public readonly array $event,
        public readonly int $channelAccountId,
    ) {}

    public function handle(WhatsappDriver $driver): void
    {
        $account = ChannelAccount::find($this->channelAccountId);
        if (! $account) {
            return;
        }

        try {
            $driver->processWppConnectInbound($this->event, $account);
        } catch (\Throwable $e) {
            Log::error('wppconnect.inbound.failed', [
                'channel_account_id' => $this->channelAccountId,
                'event' => $this->event['event'] ?? null,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
