<?php

namespace App\Modules\Broadcasting\Jobs;

use App\Modules\Broadcasting\Models\Campaign;
use App\Modules\Broadcasting\Models\CampaignRecipient;
use App\Modules\Broadcasting\Services\CampaignAudienceResolver;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class LaunchCampaignJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(public readonly int $campaignId) {}

    public function handle(CampaignAudienceResolver $audienceResolver): void
    {
        $campaign = Campaign::find($this->campaignId);
        if (! $campaign || $campaign->status !== 'queued') {
            return;
        }

        $campaign->update(['status' => 'sending']);

        $contactIds = $audienceResolver->resolve($campaign);

        if (empty($contactIds)) {
            $campaign->update([
                'status' => 'failed',
                'totals_json' => array_merge($campaign->totals_json ?? [], [
                    'total' => 0,
                    'failed_reason' => 'No matching contacts for audience.',
                ]),
            ]);

            Log::channel('json')->warning('campaign.launch.empty_audience', [
                'workspace_id' => $campaign->workspace_id,
                'campaign_id' => $campaign->id,
                'audience_type' => $campaign->audience_type,
                'audience_ref' => $campaign->audience_ref,
            ]);

            return;
        }

        $now = now();
        $totalChunks = 0;
        $totalNewContacts = 0;

        collect($contactIds)->chunk(1000)->each(function ($chunk, $i) use ($campaign, $now, &$totalChunks, &$totalNewContacts) {
            $rows = $chunk->map(fn ($contactId) => [
                'campaign_id' => $campaign->id,
                'contact_id' => $contactId,
                'status' => 'queued',
                'created_at' => $now,
                'updated_at' => $now,
            ])->values()->all();

            CampaignRecipient::insertOrIgnore($rows);

            $contactIdsInChunk = $chunk->values()->all();
            $queuedContactIds = CampaignRecipient::where('campaign_id', $campaign->id)
                ->where('status', 'queued')
                ->whereIn('contact_id', $contactIdsInChunk)
                ->pluck('contact_id')
                ->all();

            if (empty($queuedContactIds)) {
                return;
            }

            $totalNewContacts += count($queuedContactIds);
            $totalChunks++;

            DispatchCampaignChunkJob::dispatch($campaign->id, $queuedContactIds)
                ->onQueue('broadcast')
                ->delay(now()->addSeconds($i * 5));
        });

        if ($totalNewContacts === 0) {
            $campaign->updateTotals();

            return;
        }

        $finalDelay = max(60, $totalChunks * 5 + 60);
        FinalizeCampaignJob::dispatch($campaign->id)
            ->onQueue('broadcast')
            ->delay(now()->addSeconds($finalDelay));
    }
}
