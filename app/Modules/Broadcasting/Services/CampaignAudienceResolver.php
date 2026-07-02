<?php

namespace App\Modules\Broadcasting\Services;

use App\Modules\Broadcasting\Models\Campaign;
use App\Modules\Shared\Models\Contact;
use App\Modules\Shared\Models\Segment;
use App\Modules\Shared\Services\ContactService;
use App\Modules\Shared\Services\SegmentResolver;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CampaignAudienceResolver
{
    /**
     * Resolve audience to deliverable contact IDs for a campaign's channel.
     *
     * @return array<int, int>
     */
    public function resolve(Campaign $campaign): array
    {
        $contactIds = match ($campaign->audience_type) {
            'segment' => $this->resolveSegment($campaign),
            'tag' => $this->resolveTag($campaign),
            'contact_list' => $this->resolveAllContacts($campaign),
            'csv' => $this->resolveCsv($campaign),
            default => [],
        };

        if (empty($contactIds)) {
            return [];
        }

        $optInColumn = match ($campaign->channel) {
            'whatsapp' => 'opt_in_whatsapp',
            'sms' => 'opt_in_sms',
            'email' => 'opt_in_email',
            default => null,
        };

        $query = Contact::query()
            ->where('workspace_id', $campaign->workspace_id)
            ->whereIn('id', $contactIds);

        if ($optInColumn) {
            $query->where($optInColumn, true);
        }

        if ($campaign->channel === 'email') {
            $query->whereNotNull('email')->where('email', '!=', '');
        } else {
            $query->whereNotNull('phone_e164')->where('phone_e164', '!=', '');
        }

        return $query->pluck('id')->all();
    }

    public function count(Campaign $campaign): int
    {
        return count($this->resolve($campaign));
    }

    /** @return array<int, int> */
    private function resolveSegment(Campaign $campaign): array
    {
        $segment = Segment::where('workspace_id', $campaign->workspace_id)
            ->find($campaign->audience_ref);

        if (! $segment) {
            return [];
        }

        if ($segment->type === 'static') {
            return $segment->contacts()->pluck('contacts.id')->all();
        }

        return app(SegmentResolver::class)
            ->query($segment)
            ->pluck('id')
            ->all();
    }

    /** @return array<int, int> */
    private function resolveTag(Campaign $campaign): array
    {
        if (! $campaign->audience_ref) {
            return [];
        }

        return Contact::where('workspace_id', $campaign->workspace_id)
            ->whereHas('tags', fn ($q) => $q->where('contact_tags.id', $campaign->audience_ref))
            ->pluck('id')
            ->all();
    }

    /** @return array<int, int> */
    private function resolveAllContacts(Campaign $campaign): array
    {
        $ids = [];
        Contact::where('workspace_id', $campaign->workspace_id)
            ->select('id')
            ->orderBy('id')
            ->lazy(2000)
            ->each(function (Contact $c) use (&$ids) {
                $ids[] = $c->id;
            });

        return $ids;
    }

    /** @return array<int, int> */
    private function resolveCsv(Campaign $campaign): array
    {
        $path = $campaign->audience_ref;

        if (
            $path &&
            (str_contains($path, '..') || str_starts_with($path, '/') || str_starts_with($path, '\\'))
        ) {
            Log::channel('json')->warning('campaign.csv.invalid_path', [
                'campaign_id' => $campaign->id,
                'path' => $path,
            ]);

            return [];
        }

        if (! $path || ! Storage::exists($path)) {
            Log::channel('json')->warning('campaign.csv.missing', [
                'campaign_id' => $campaign->id,
                'path' => $path,
            ]);

            return [];
        }

        $rows = [];
        $handle = fopen(Storage::path($path), 'r');
        if (! $handle) {
            return [];
        }

        $header = null;
        try {
            while (($line = fgetcsv($handle)) !== false) {
                if ($header === null) {
                    $header = array_map(fn ($h) => trim(strtolower((string) $h)), $line);

                    continue;
                }
                $rows[] = array_combine(
                    $header,
                    array_pad($line, count($header), null),
                );
            }
        } finally {
            fclose($handle);
        }

        if (empty($rows)) {
            return [];
        }

        $service = app(ContactService::class);
        $contactIds = [];
        foreach ($rows as $row) {
            try {
                $phone = $row['phone_e164'] ?? $row['phone'] ?? null;
                if (! $phone && $campaign->channel !== 'email') {
                    continue;
                }

                $contact = $service->upsert($campaign->workspace_id, [
                    'phone_e164' => $phone,
                    'email' => $row['email'] ?? null,
                    'opt_in_whatsapp' => $this->coerceBool($row['opt_in_whatsapp'] ?? $row['opt_in_wa'] ?? true),
                    'opt_in_sms' => $this->coerceBool($row['opt_in_sms'] ?? true),
                    'opt_in_email' => $this->coerceBool($row['opt_in_email'] ?? true),
                    'source' => 'campaign_csv',
                ]);
                $contactIds[] = $contact->id;
            } catch (\Throwable $e) {
                Log::channel('json')->info('campaign.csv.row_failed', [
                    'campaign_id' => $campaign->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return array_values(array_unique($contactIds));
    }

    private function coerceBool(mixed $v): bool
    {
        if (is_bool($v)) {
            return $v;
        }
        if (is_numeric($v)) {
            return (int) $v === 1;
        }

        return in_array(strtolower((string) $v), ['1', 'true', 'yes', 'y', 'on'], true);
    }
}
