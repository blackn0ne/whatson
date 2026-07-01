<?php

namespace App\Console\Commands;

use App\Services\I18n\I18nFileService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Translate resources/js/locales/{locale}.json from English using OpenAI.
 * Translates values that are empty or still identical to the English source,
 * in batches, preserving keys, placeholders ({{x}}, {x}, :attr, %s) and HTML tags.
 * Progress is saved after every batch so the job can be safely re-run/resumed.
 */
class I18nTranslateCommand extends Command
{
    protected $signature = 'i18n:translate
        {locale : Target locale code, e.g. ru}
        {--batch=40 : Number of keys per OpenAI request}
        {--force : Re-translate all keys, even ones that already differ from English}
        {--insecure : Disable SSL certificate verification (local dev only)}';

    protected $description = 'Translate a locale JSON file from English using OpenAI';

    public function handle(I18nFileService $files): int
    {
        $target = (string) $this->argument('locale');
        if ($target === 'en') {
            $this->error('English is the source language; nothing to translate.');

            return self::FAILURE;
        }

        $apiKey = env('OPENAI_API_KEY');
        if (empty($apiKey)) {
            $this->error('OPENAI_API_KEY is not set in .env');

            return self::FAILURE;
        }
        $model = env('OPENAI_MODEL', 'gpt-4o-mini');

        $en = $files->getFlatDictionary('en');
        if (empty($en)) {
            $this->error('English dictionary (en.json) is empty or missing.');

            return self::FAILURE;
        }

        $current = $files->getFlatDictionary($target);
        $force = (bool) $this->option('force');

        $pending = [];
        foreach ($en as $key => $enVal) {
            if (! is_string($enVal) || trim($enVal) === '') {
                continue;
            }
            $cur = $current[$key] ?? '';
            if ($force || $cur === '' || $cur === $enVal) {
                $pending[$key] = $enVal;
            }
        }

        $total = count($pending);
        if ($total === 0) {
            $this->info("Nothing to translate — {$target}.json is already up to date.");

            return self::SUCCESS;
        }

        $this->info("Translating {$total} keys to '{$target}' with {$model}...");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $batchSize = max(1, (int) $this->option('batch'));
        $batches = array_chunk($pending, $batchSize, true);
        $done = 0;

        $insecure = (bool) $this->option('insecure');

        foreach ($batches as $batch) {
            $translated = $this->translateBatch($batch, $target, $apiKey, $model, $insecure);

            foreach ($batch as $key => $enVal) {
                $current[$key] = $translated[$key] ?? $enVal;
            }

            // Persist after every batch so progress is never lost.
            $files->putFlatDictionary($target, $current);

            $done += count($batch);
            $bar->advance(count($batch));
        }

        $bar->finish();
        $this->newLine(2);
        $files->invalidateCache($target);
        $this->info("Done. Translated ~{$done} keys into resources/js/locales/{$target}.json");

        return self::SUCCESS;
    }

    /**
     * Translate a batch of key => englishValue and return key => russianValue.
     * On failure, returns an empty array (caller keeps English fallback).
     *
     * @param  array<string,string>  $batch
     * @return array<string,string>
     */
    private function translateBatch(array $batch, string $target, string $apiKey, string $model, bool $insecure = false): array
    {
        $language = $this->languageName($target);

        $system = "You are a professional software localization engine. Translate UI string VALUES from English into {$language}. "
            .'Return ONLY a JSON object with exactly the same keys as the input, where each value is the translated string. '
            .'Rules: keep placeholders intact and untouched (e.g. {{name}}, {count}, :attribute, %s, %d, $t(...)); '
            .'keep HTML tags and their attributes; do not translate brand/product names, URLs, code, or email addresses; '
            .'preserve leading/trailing spaces and punctuation; use natural, concise UI wording.';

        $payload = json_encode($batch, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        try {
            $request = Http::withHeaders(['Authorization' => 'Bearer '.$apiKey])
                ->timeout(120)
                ->retry(3, 1000);
            if ($insecure) {
                $request = $request->withoutVerifying();
            }
            $resp = $request->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $model,
                    'temperature' => 0.2,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => $payload],
                    ],
                ]);
        } catch (\Throwable $e) {
            $this->newLine();
            $this->warn('OpenAI request failed: '.$e->getMessage());

            return [];
        }

        if (! $resp->successful()) {
            $this->newLine();
            $this->warn('OpenAI error '.$resp->status().': '.mb_substr($resp->body(), 0, 300));

            return [];
        }

        $content = $resp->json('choices.0.message.content');
        if (! is_string($content)) {
            return [];
        }

        $decoded = json_decode($content, true);
        if (! is_array($decoded)) {
            return [];
        }

        return array_filter($decoded, fn ($v) => is_string($v));
    }

    private function languageName(string $code): string
    {
        return [
            'ru' => 'Russian',
            'ar' => 'Arabic',
            'hi' => 'Hindi',
            'bn' => 'Bengali',
            'es' => 'Spanish',
            'fr' => 'French',
            'de' => 'German',
            'pt' => 'Portuguese',
            'zh' => 'Chinese (Simplified)',
        ][$code] ?? $code;
    }
}
