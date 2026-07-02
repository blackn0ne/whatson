<?php

namespace App\Modules\Broadcasting\Services;

class CampaignSendSettings
{
    /** @var array<string, array{messages_per_minute: int, chunk_size: int, chunk_pause_seconds: int, delay_ms: int}> */
    private const PRESETS = [
        'safe' => [
            'messages_per_minute' => 15,
            'chunk_size' => 50,
            'chunk_pause_seconds' => 120,
            'delay_ms' => 4000,
        ],
        'normal' => [
            'messages_per_minute' => 30,
            'chunk_size' => 100,
            'chunk_pause_seconds' => 60,
            'delay_ms' => 2000,
        ],
        'fast' => [
            'messages_per_minute' => 45,
            'chunk_size' => 150,
            'chunk_pause_seconds' => 30,
            'delay_ms' => 1333,
        ],
    ];

    /**
     * @param  array<string, mixed>|null  $payload
     * @return array{messages_per_minute: int, chunk_size: int, chunk_pause_seconds: int, delay_ms: int, preset: string}
     */
    public static function resolve(?array $payload): array
    {
        $settings = is_array($payload['send_settings'] ?? null) ? $payload['send_settings'] : [];
        $preset = (string) ($settings['preset'] ?? 'normal');

        if ($preset !== 'custom' && isset(self::PRESETS[$preset])) {
            return array_merge(self::PRESETS[$preset], ['preset' => $preset]);
        }

        $mpm = max(1, min(60, (int) ($settings['messages_per_minute'] ?? 30)));
        $chunk = max(10, min(1000, (int) ($settings['chunk_size'] ?? 100)));
        $pause = max(0, min(600, (int) ($settings['chunk_pause_seconds'] ?? 60)));

        return [
            'preset' => 'custom',
            'messages_per_minute' => $mpm,
            'chunk_size' => $chunk,
            'chunk_pause_seconds' => $pause,
            'delay_ms' => (int) round(60000 / $mpm),
        ];
    }
}
