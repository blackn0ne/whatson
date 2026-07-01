<?php

namespace App\Modules\AI\Jobs;

use App\Modules\AI\Models\AiKbChunk;
use App\Modules\AI\Models\AiKbDocument;
use App\Modules\AI\Services\EmbeddingStore;
use App\Modules\AI\Services\Llm\LlmManager;
use App\Modules\AI\Services\LlmGateway;
use App\Services\StorageManager;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\Client\Response;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use League\HTMLToMarkdown\HtmlConverter;
use Smalot\PdfParser\Parser;

class IndexDocumentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 120;

    public function __construct(public readonly int $documentId) {}

    public function handle(LlmGateway $llm, EmbeddingStore $store, StorageManager $storage): void
    {
        $doc = AiKbDocument::with('chunks')->find($this->documentId);
        if (! $doc) {
            return;
        }

        $doc->update(['status' => 'indexing']);

        try {
            $text = $this->extractText($doc, $storage);
            $chunks = $this->chunk($text);

            // Remove old chunks
            $doc->chunks()->delete();

            $kb = $doc->knowledgeBase ?? $doc->load('knowledgeBase')->knowledgeBase;
            $kbId = $kb?->id ?? 0;

            $chunkModels = [];
            foreach ($chunks as $i => $chunkText) {
                $chunkModels[] = AiKbChunk::create([
                    'kb_id' => $kbId,
                    'document_id' => $doc->id,
                    'ord' => $i,
                    'content' => $chunkText,
                    'tokens' => (int) (strlen($chunkText) / 4),
                ]);
            }

            // Embed all chunks.
            //
            // A missing embedding provider (Anthropic-only or none configured) is a
            // non-fatal condition: the document is still indexed as plain text and we
            // log it so operators can see RAG won't work until a provider is added.
            //
            // A transient embedding API error, by contrast, is allowed to propagate so
            // the queue retries — rather than silently marking the document "indexed"
            // with no vectors.
            $workspaceId = $kb?->workspace_id ?? 0;

            if ($workspaceId && ! empty($chunkModels)) {
                if ($this->embedProviderAvailable($workspaceId)) {
                    foreach (array_chunk($chunkModels, 20) as $batch) {
                        $texts = array_map(fn ($c) => $c->content, $batch);
                        $embeddings = $llm->embed($workspaceId, $texts);

                        foreach ($batch as $j => $chunk) {
                            if (isset($embeddings[$j])) {
                                $store->storeEmbedding($chunk, $embeddings[$j]);
                            }
                        }
                    }
                } else {
                    Log::warning('IndexDocumentJob: indexed without embeddings — no embedding-capable provider configured', [
                        'document_id' => $doc->id,
                        'kb_id' => $kbId,
                        'workspace_id' => $workspaceId,
                    ]);
                }
            }

            $doc->update([
                'status' => 'indexed',
                'last_indexed_at' => now(),
                'tokens' => array_sum(array_map(fn ($c) => $c->tokens, $chunkModels)),
            ]);
        } catch (\Throwable $e) {
            $doc->update(['status' => 'error']);
            throw $e;
        }
    }

    /** True when the workspace has an embedding-capable provider (OpenAI/Gemini). */
    private function embedProviderAvailable(int $workspaceId): bool
    {
        // Any failure to RESOLVE a provider (none configured, orphaned workspace,
        // malformed config) is treated as "no embeddings" — a non-fatal condition,
        // so the document still indexes as plain text. This deliberately does NOT
        // swallow errors from the actual embed() call below, which must still
        // propagate so the queue retries rather than indexing with no vectors.
        try {
            LlmManager::forWorkspaceEmbed($workspaceId);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private function extractText(AiKbDocument $doc, StorageManager $storage): string
    {
        return match ($doc->source_type) {
            'text' => $doc->source_ref ?? '',
            'url' => $this->fetchUrl($doc->source_ref ?? ''),
            'file' => $this->readFile($doc->source_ref ?? '', $storage),
            'faq' => $this->formatFaq($doc->source_ref ?? ''),
            'sitemap' => $this->processSitemap($doc),
            default => '',
        };
    }

    private function fetchUrl(string $url): string
    {
        if (empty($url)) {
            return '';
        }
        $resp = $this->safeGet($url, 30);
        if (! $resp) {
            return '';
        }
        $html = $resp->body();
        // Convert HTML to Markdown using league/html-to-markdown, then strip remaining tags
        if (class_exists(HtmlConverter::class)) {
            $converter = new HtmlConverter(['strip_tags' => true]);

            return $converter->convert($html);
        }

        return strip_tags($html);
    }

    /**
     * Fetch a tenant-supplied URL with SSRF protection.
     *
     * Knowledge-base "url" and "sitemap" documents let a tenant point the crawler
     * at an arbitrary address. Without guarding, that address could resolve to a
     * loopback/private/link-local host (e.g. 127.0.0.1, 10.0.0.0/8, or the cloud
     * metadata endpoint 169.254.169.254) and turn the indexer into a server-side
     * request forgery primitive. We therefore:
     *   1. allow only http/https schemes,
     *   2. resolve the host and reject any private/reserved IP (IPv4 + IPv6),
     *   3. re-validate every redirect hop (so a public host can't 30x to an
     *      internal one) and forbid non-HTTP(S) redirect protocols.
     *
     * Returns the successful Response, or null when the URL is unsafe, the request
     * fails, or the response is not 2xx. Failures are logged, never thrown, so a
     * single bad document doesn't fail the whole queue batch.
     */
    private function safeGet(string $url, int $timeout): ?Response
    {
        try {
            $this->assertSafeUrl($url);

            $resp = Http::retry(2, 500)
                ->timeout($timeout)
                ->withOptions(['allow_redirects' => [
                    'max' => 5,
                    'strict' => true,
                    'referer' => false,
                    'protocols' => ['http', 'https'],
                    'on_redirect' => function ($request, $response, $uri): void {
                        $this->assertSafeUrl((string) $uri);
                    },
                ]])
                ->get($url);
        } catch (\Throwable $e) {
            Log::warning('IndexDocumentJob: blocked or failed URL fetch', [
                'url' => $url,
                'reason' => $e->getMessage(),
            ]);

            return null;
        }

        return $resp->successful() ? $resp : null;
    }

    /**
     * Throw if $url is not a fetchable public HTTP(S) address.
     */
    private function assertSafeUrl(string $url): void
    {
        $parts = parse_url($url);
        if ($parts === false) {
            throw new \RuntimeException("Unparseable URL: {$url}");
        }

        $scheme = strtolower($parts['scheme'] ?? '');
        if (! in_array($scheme, ['http', 'https'], true)) {
            throw new \RuntimeException("Refusing non-HTTP(S) URL: {$url}");
        }

        $host = $parts['host'] ?? '';
        if ($host === '') {
            throw new \RuntimeException("Refusing URL with no host: {$url}");
        }

        $ips = $this->resolveHost($host);
        if (empty($ips)) {
            throw new \RuntimeException("Could not resolve host: {$host}");
        }

        foreach ($ips as $ip) {
            if (! $this->isPublicIp($ip)) {
                throw new \RuntimeException("Refusing private/reserved address {$ip} for host {$host}");
            }
        }
    }

    /**
     * Resolve a host to its IP addresses (IPv4 + IPv6). A literal IP resolves to
     * itself so that e.g. "http://127.0.0.1" is still rejected downstream.
     *
     * @return string[]
     */
    private function resolveHost(string $host): array
    {
        $host = trim($host, '[]'); // IPv6 literal hosts arrive bracketed: [::1]

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return [$host];
        }

        $ips = [];

        $v4 = @gethostbynamel($host);
        if (is_array($v4)) {
            $ips = array_merge($ips, $v4);
        }

        $aaaa = @dns_get_record($host, DNS_AAAA);
        if (is_array($aaaa)) {
            foreach ($aaaa as $record) {
                if (! empty($record['ipv6'])) {
                    $ips[] = $record['ipv6'];
                }
            }
        }

        return array_values(array_unique($ips));
    }

    /**
     * True only for globally-routable addresses — rejects private (10/8, 172.16/12,
     * 192.168/16, fc00::/7, fe80::/10) and reserved (loopback 127/8, link-local
     * 169.254/16 incl. the metadata IP, 0/8, 240/4, ::1) ranges.
     */
    private function isPublicIp(string $ip): bool
    {
        return (bool) filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        );
    }

    /**
     * Read an uploaded document back from the active storage disk.
     *
     * The stored source_ref is a disk-relative key (e.g. "uploads/kb-docs/x.pdf"),
     * NOT an absolute local path, so it must be read through the Storage disk —
     * which works for both the local "public" disk and cloud disks (S3/Spaces/Wasabi).
     */
    private function readFile(string $path, StorageManager $storage): string
    {
        if ($path === '') {
            return '';
        }

        $disk = $storage->disk();
        if (! $disk->exists($path)) {
            return '';
        }

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if ($ext === 'pdf') {
            // Smalot's parser needs a real local file, so stream the (possibly remote)
            // object into a temp file before parsing, then clean it up.
            $tmp = tempnam(sys_get_temp_dir(), 'kbpdf_');
            try {
                file_put_contents($tmp, $disk->get($path));
                $parser = new Parser;

                return $parser->parseFile($tmp)->getText();
            } finally {
                @unlink($tmp);
            }
        }

        return (string) ($disk->get($path) ?? '');
    }

    /**
     * Turn the FAQ payload (a JSON array of {question, answer} pairs produced by the
     * UI) into clean, embeddable text. Falls back to the raw string if it isn't JSON.
     */
    private function formatFaq(string $raw): string
    {
        if (trim($raw) === '') {
            return '';
        }

        $decoded = json_decode($raw, true);
        if (! is_array($decoded)) {
            // Not JSON — treat as plain text.
            return $raw;
        }

        $parts = [];
        foreach ($decoded as $pair) {
            if (! is_array($pair)) {
                continue;
            }
            $q = trim((string) ($pair['question'] ?? ''));
            $a = trim((string) ($pair['answer'] ?? ''));
            if ($q === '' && $a === '') {
                continue;
            }
            $parts[] = "Q: {$q}\nA: {$a}";
        }

        return implode("\n\n", $parts);
    }

    /**
     * Parse a sitemap and fan out one lightweight child job per page URL.
     *
     * This job stays cheap on purpose: it only fetches + parses the XML and
     * enqueues child "url" documents. The actual page crawling/embedding happens
     * in those child jobs on the queue, so the originating web request never
     * blocks on hundreds of HTTP fetches (which previously caused a 502 when the
     * queue ran synchronously).
     *
     * Handles both <urlset> (a flat list of pages) and <sitemapindex> (a list of
     * nested sitemaps, e.g. Yoast/WordPress) — for the latter, each nested sitemap
     * is enqueued as its own "sitemap" child and expanded recursively.
     */
    private function processSitemap(AiKbDocument $doc): string
    {
        $sitemapUrl = $doc->source_ref ?? '';
        if (empty($sitemapUrl)) {
            return '';
        }
        $resp = $this->safeGet($sitemapUrl, 20);
        if (! $resp) {
            return '';
        }

        try {
            $xml = simplexml_load_string($resp->body());
            if ($xml === false) {
                throw new \RuntimeException('Unparseable sitemap XML');
            }

            // <sitemapindex> → nested sitemaps; <urlset> → page URLs.
            $isIndex = isset($xml->sitemap);
            $childType = $isIndex ? 'sitemap' : 'url';

            $locs = [];
            foreach (($isIndex ? $xml->sitemap : $xml->url) as $node) {
                $loc = trim((string) $node->loc);
                if ($loc !== '') {
                    $locs[$loc] = true; // dedupe by URL
                }
            }

            foreach (array_slice(array_keys($locs), 0, 200) as $loc) {
                $child = AiKbDocument::create([
                    'kb_id' => $doc->kb_id,
                    'title' => $loc,
                    'source_type' => $childType,
                    'source_ref' => $loc,
                    'status' => 'pending',
                ]);
                static::dispatch($child->id)->onQueue('ai');
            }
        } catch (\Throwable) {
            // Malformed sitemap; fall back to fetching the URL as HTML
            return $this->fetchUrl($sitemapUrl);
        }

        return '';
    }

    private function chunk(string $text, int $size = 800, int $overlap = 100): array
    {
        $words = preg_split('/\s+/', trim($text)) ?: [];
        $chunks = [];
        $i = 0;

        while ($i < count($words)) {
            $slice = array_slice($words, $i, $size);
            $chunks[] = implode(' ', $slice);
            $i += ($size - $overlap);
        }

        return array_values(array_filter($chunks));
    }
}
