<?php

namespace App\Modules\Whatsapp\Services;

use App\Events\MessageReceived;
use App\Events\MessageStatusUpdated;
use App\Modules\Broadcasting\Models\CampaignRecipient;
use App\Modules\Shared\Contracts\ChannelDriverInterface;
use App\Modules\Shared\Models\ChannelAccount;
use App\Modules\Shared\Models\Contact;
use App\Modules\Shared\Models\Conversation;
use App\Modules\Shared\Models\Message;
use App\Modules\Shared\Services\ContactService;
use App\Support\PhoneNumberNormalizer;
use App\Support\WppAddressParser;
use App\Modules\Whatsapp\Models\WhatsappPhoneNumber;
use App\Modules\Whatsapp\Models\WhatsappTemplate;
use App\Services\WebhookIdempotencyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WhatsappDriver implements ChannelDriverInterface
{
    public function __construct(
        private readonly ContactService $contactService,
        private readonly WhatsappGatewayManager $gateways,
    ) {}

    public function send(Message $message): string
    {
        $conversation = $message->conversation;
        $gateway = $this->gateways->forConversation($conversation);
        $recipient = $this->resolveRecipient($conversation);

        $payload = $message->payload ?? [];

        return match ($message->type) {
            'template' => $gateway->sendTemplate(
                $recipient,
                $payload['template']['name'] ?? '',
                $payload['template']['language'] ?? 'en',
                $payload['template']['components'] ?? [],
            ),
            'interactive' => $gateway->sendInteractive($recipient, $payload['interactive'] ?? []),
            'image' => $gateway->sendMedia($recipient, 'image', $this->mediaOpts($payload)),
            'video' => $gateway->sendMedia($recipient, 'video', $this->mediaOpts($payload)),
            'document' => $gateway->sendMedia($recipient, 'document', $this->mediaOpts($payload)),
            'audio' => $gateway->sendMedia($recipient, 'audio', $this->mediaOpts($payload)),
            'location' => $gateway->sendLocation(
                $recipient,
                (float) ($payload['location']['latitude'] ?? 0),
                (float) ($payload['location']['longitude'] ?? 0),
                $payload['location']['name'] ?? null,
                $payload['location']['address'] ?? null,
            ),
            default => $gateway->sendText($recipient, $message->body ?? ''),
        };
    }

    private function resolveRecipient(Conversation $conversation): string
    {
        $account = $conversation->channelAccount;

        if ($account?->isUnofficial()) {
            return WppAddressParser::toSendAddress(
                $conversation->contact->phone_e164,
                $conversation->external_thread_id,
            );
        }

        $phone = $conversation->contact->phone_e164;
        if (! $phone) {
            throw new \InvalidArgumentException('Contact has no phone number.');
        }

        return $phone;
    }

    /**
     * Normalize a message payload into the media option shape shared by both
     * providers (Meta uses media_id/link; WPPConnect uses link only).
     *
     * @param  array<string, mixed>  $payload
     * @return array{media_id: string, link: ?string, caption: ?string, filename: ?string}
     */
    private function mediaOpts(array $payload): array
    {
        return [
            'media_id' => $payload['media_id'] ?? '',
            'link' => $payload['link'] ?? null,
            'caption' => $payload['caption'] ?? null,
            'filename' => $payload['filename'] ?? null,
        ];
    }

    public function receiveWebhook(Request $request): array
    {
        return $this->processWebhookPayload($request->all());
    }

    public function processWebhookPayload(array $payload, string $verifyToken = ''): array
    {
        $processed = [];

        foreach ($payload['entry'] ?? [] as $entry) {
            $wabaId = (string) ($entry['id'] ?? '');

            foreach ($entry['changes'] ?? [] as $change) {
                $field = $change['field'] ?? '';
                $value = $change['value'] ?? [];

                if ($field === 'message_template_status_update') {
                    $this->processTemplateStatusUpdate($wabaId, $value);

                    continue;
                }

                if (in_array($field, ['phone_number_quality_update', 'phone_number_name_update', 'account_update'], true)) {
                    $this->processPhoneNumberUpdate($value);

                    continue;
                }

                foreach ($value['messages'] ?? [] as $msg) {
                    try {
                        $processed[] = $this->processInboundMessage($value, $msg);
                    } catch (\Throwable $e) {
                        Log::error('WhatsApp webhook processing failed', ['error' => $e->getMessage(), 'msg' => $msg]);
                    }
                }

                foreach ($value['statuses'] ?? [] as $status) {
                    $this->processStatusUpdate($status);
                }
            }
        }

        return $processed;
    }

    private function processTemplateStatusUpdate(string $wabaId, array $value): void
    {
        $event = strtoupper((string) ($value['event'] ?? ''));
        $name = $value['message_template_name'] ?? null;
        $language = $value['message_template_language'] ?? 'en';

        if (! $wabaId || ! $name || ! $event) {
            return;
        }

        $statusMap = [
            'APPROVED' => 'APPROVED',
            'REJECTED' => 'REJECTED',
            'PENDING' => 'PENDING',
            'PAUSED' => 'PAUSED',
            'DISABLED' => 'PAUSED',
        ];
        $status = $statusMap[$event] ?? null;
        if (! $status) {
            return;
        }

        $reason = $value['reason'] ?? $value['rejection_reason'] ?? null;

        WhatsappTemplate::where('waba_id', $wabaId)
            ->where('name', $name)
            ->where('language', $language)
            ->update(array_filter([
                'status' => $status,
                'rejection_reason' => $status === 'REJECTED' ? (is_string($reason) ? $reason : json_encode($reason)) : null,
                'meta_template_id' => isset($value['message_template_id'])
                    ? (string) $value['message_template_id']
                    : null,
            ]));
    }

    private function processPhoneNumberUpdate(array $value): void
    {
        $phoneNumberId = $value['phone_number_id'] ?? null;
        if (! $phoneNumberId) {
            return;
        }

        // Map Meta's name decision to our name_status values
        $decision = strtoupper((string) ($value['decision'] ?? ''));
        $nameStatus = match ($decision) {
            'APPROVED' => 'APPROVED',
            'REJECTED' => 'DECLINED',
            default => null,
        };

        $patch = array_filter([
            'quality_rating' => $value['current_quality_rating'] ?? $value['quality_rating'] ?? null,
            'messaging_limit_tier' => $value['current_limit'] ?? $value['messaging_limit_tier'] ?? null,
            'display_phone' => $value['display_phone_number'] ?? null,
            // When a name is approved, verified_name updates to the new name
            'verified_name' => $nameStatus === 'APPROVED'
                                          ? ($value['requested_verified_name'] ?? $value['verified_name'] ?? null)
                                          : ($value['verified_name'] ?? null),
            'name_status' => $nameStatus,
            // Clear requested_verified_name once the decision is made
            'requested_verified_name' => in_array($nameStatus, ['APPROVED', 'DECLINED'], true) ? null : null,
        ], fn ($v) => $v !== null && $v !== '');

        if ($patch === []) {
            return;
        }

        WhatsappPhoneNumber::where('phone_number_id', (string) $phoneNumberId)->update($patch);

        Log::info('whatsapp.phone_number.updated', [
            'phone_number_id' => $phoneNumberId,
            'patch' => $patch,
        ]);
    }

    public function verifyCreds(): bool
    {
        return true;
    }

    /**
     * Normalize and persist an inbound event coming from a WPPConnect Server
     * webhook. Produces the same Message / Conversation shape as the Meta path
     * so the inbox, auto-replies and automations work identically.
     *
     * @param  array<string, mixed>  $event  The raw webhook body.
     */
    public function processWppConnectInbound(array $event, ChannelAccount $account): ?Message
    {
        $eventType = (string) ($event['event'] ?? 'onmessage');

        if (in_array($eventType, ['onack', 'onmessageack'], true)) {
            $this->processWppConnectAck($event);

            return null;
        }

        if (! in_array($eventType, ['onmessage', 'message', 'received', 'onselfmessage'], true)) {
            return null;
        }

        // Ignore our own outbound echoes, groups, and status broadcasts.
        if (($event['fromMe'] ?? false) === true || ($eventType === 'onselfmessage')) {
            return null;
        }
        if (($event['isGroupMsg'] ?? false) === true) {
            return null;
        }
        $from = (string) ($event['from'] ?? '');
        if ($from === '' || str_contains($from, '@g.us') || str_contains($from, 'status@broadcast')) {
            return null;
        }

        $parsed = WppAddressParser::fromInboundEvent($event);
        if ($parsed === null) {
            return null;
        }

        $msgId = $this->wppMessageId($event['id'] ?? null);

        if ($msgId && ! app(WebhookIdempotencyService::class)->isNewEvent('whatsapp_msg', $msgId)) {
            $existing = Message::where('provider_message_id', $msgId)->first();
            if ($existing) {
                return $existing;
            }

            throw new \RuntimeException("Duplicate WPPConnect webhook skipped (concurrent): {$msgId}");
        }

        $workspaceId = (int) $account->workspace_id;
        $jid = $parsed['jid'];

        $conversation = Conversation::where('workspace_id', $workspaceId)
            ->where('channel_account_id', $account->id)
            ->where('external_thread_id', $jid)
            ->first();

        if ($conversation) {
            $contact = $conversation->contact;
            if ($parsed['display_name'] && ! trim($contact->first_name ?? '')) {
                $contact->update(['first_name' => $parsed['display_name']]);
            }
        } elseif ($parsed['phone_e164']) {
            $contact = $this->contactService->upsert($workspaceId, array_filter([
                'phone_e164' => $parsed['phone_e164'],
                'first_name' => $parsed['display_name'],
                'opt_in_whatsapp' => true,
                'source' => 'whatsapp_inbound',
            ], fn ($v) => $v !== null && $v !== ''));
        } else {
            $contact = Contact::where('workspace_id', $workspaceId)
                ->where('custom_fields->whatsapp_jid', $jid)
                ->first();

            if (! $contact) {
                $contact = Contact::create([
                    'workspace_id' => $workspaceId,
                    'first_name' => $parsed['display_name'] ?? 'WhatsApp',
                    'opt_in_whatsapp' => true,
                    'source' => 'whatsapp_inbound',
                    'custom_fields' => ['whatsapp_jid' => $jid],
                ]);
            } elseif ($parsed['display_name'] && ! trim($contact->first_name ?? '')) {
                $contact->update(['first_name' => $parsed['display_name']]);
            }
        }

        $conversation = Conversation::firstOrCreate(
            [
                'workspace_id' => $workspaceId,
                'channel_account_id' => $account->id,
                'external_thread_id' => $jid,
            ],
            [
                'contact_id' => $contact->id,
                'status' => 'open',
            ],
        );

        if ((int) $conversation->contact_id !== (int) $contact->id) {
            $conversation->update(['contact_id' => $contact->id]);
        }

        $type = $this->mapWppType((string) ($event['type'] ?? 'chat'));
        $body = $this->wppBody($event, $type);

        if ($type === 'unsupported' && $body !== '') {
            $type = 'text';
        }

        $message = Message::create([
            'conversation_id' => $conversation->id,
            'direction' => 'in',
            'channel' => 'whatsapp',
            'type' => $type,
            'payload' => $event,
            'body' => $body,
            'status' => 'delivered',
            'provider_message_id' => $msgId,
            'sent_by' => 'human',
            'sent_at' => now()->createFromTimestamp((int) ($event['t'] ?? $event['timestamp'] ?? time())),
        ]);

        $conversation->update([
            'last_message_at' => $message->sent_at,
            'status' => 'open',
            'unread_count' => $conversation->unread_count + 1,
            'last_inbound_at' => $message->sent_at,
            'first_response_at' => $conversation->first_response_at && $conversation->last_inbound_at
                ? ($message->sent_at > $conversation->first_response_at ? null : $conversation->first_response_at)
                : $conversation->first_response_at,
        ]);

        MessageReceived::dispatch($message);

        return $message;
    }

    /** Map a WPPConnect message type to our internal Message.type set. */
    private function mapWppType(string $type): string
    {
        $type = strtolower(trim($type));

        return match ($type) {
            'chat', 'text', 'conversation', '' => 'text',
            'image', 'image/jpeg', 'image/png' => 'image',
            'video', 'video/mp4' => 'video',
            'ptt', 'audio', 'audio/ogg', 'audio/mpeg' => 'audio',
            'document', 'application/pdf' => 'document',
            'location' => 'location',
            'sticker', 'webp' => 'sticker',
            'vcard', 'multi_vcard', 'contact', 'contacts' => 'contacts',
            default => 'unsupported',
        };
    }

    /**
     * Human-readable preview body for a WPPConnect inbound message.
     *
     * @param  array<string, mixed>  $event
     */
    private function wppBody(array $event, string $type): string
    {
        $body = $event['body']
            ?? $event['content']
            ?? (is_array($event['message'] ?? null) ? ($event['message']['body'] ?? $event['message']['content'] ?? null) : null)
            ?? $event['caption']
            ?? '';

        if (is_string($body) && $body !== '' && ! $this->looksLikeBase64Media($body)) {
            if ($type === 'text' || $type === 'unsupported') {
                return $body;
            }
        }

        $caption = is_string($event['caption'] ?? null) ? $event['caption'] : '';
        if ($caption !== '') {
            return $caption;
        }

        return match ($type) {
            'image' => '🖼 Image',
            'video' => '🎬 Video',
            'audio' => '🎤 Audio',
            'document' => '📄 '.($event['filename'] ?? 'Document'),
            'location' => '📍 Location',
            'sticker' => '😊 Sticker',
            'contacts' => '👤 Contact',
            'text' => (is_string($body) && ! $this->looksLikeBase64Media($body)) ? $body : '',
            default => '',
        };
    }

    private function looksLikeBase64Media(string $value): bool
    {
        $trimmed = ltrim($value);

        return str_starts_with($trimmed, '/9j/')
            || str_starts_with($trimmed, 'iVBOR')
            || (strlen($trimmed) > 500 && preg_match('/^[A-Za-z0-9+\/=\r\n]+$/', $trimmed) === 1);
    }

    /** Extract a stable WhatsApp message id from a WPPConnect id field. */
    private function wppMessageId(mixed $id): ?string
    {
        if (is_string($id)) {
            return $id !== '' ? $id : null;
        }
        if (is_array($id)) {
            $serialized = $id['_serialized'] ?? $id['id'] ?? null;

            return is_string($serialized) && $serialized !== '' ? $serialized : null;
        }

        return null;
    }

    /**
     * Handle a WPPConnect delivery ack. ack levels: 1 = sent, 2 = delivered,
     * 3 = read, -1 = failed. Reuses the Meta status pipeline.
     *
     * @param  array<string, mixed>  $event
     */
    private function processWppConnectAck(array $event): void
    {
        $id = $this->wppMessageId($event['id'] ?? null);
        if (! $id) {
            return;
        }

        $ack = (int) ($event['ack'] ?? 0);
        $status = match ($ack) {
            1 => 'sent',
            2 => 'delivered',
            3, 4 => 'read',
            -1 => 'failed',
            default => null,
        };

        if ($status === null) {
            return;
        }

        $this->processStatusUpdate(['id' => $id, 'status' => $status]);
    }

    private function processInboundMessage(array $value, array $msg): Message
    {
        $msgId = $msg['id'] ?? null;

        // Idempotency guard — skip if already processed or being processed concurrently.
        // insertOrIgnore is atomic, so only one concurrent request gets affected=1.
        // If affected=0 (already seen), never fall through — throw so the outer
        // try-catch skips this duplicate without creating a second message or auto-reply.
        if ($msgId && ! app(WebhookIdempotencyService::class)->isNewEvent('whatsapp_msg', $msgId)) {
            $existing = Message::where('provider_message_id', $msgId)->first();
            if ($existing) {
                return $existing;
            }
            // Race condition: the first request hasn't committed the message yet.
            // Skip rather than fall through and create a duplicate.
            throw new \RuntimeException("Duplicate webhook skipped (concurrent): {$msgId}");
        }

        // TEMP DIAGNOSTIC (remove once incoming poll shape is confirmed):
        // log the raw payload of unsupported / error-bearing messages so we can
        // see exactly how WhatsApp delivers polls and other unsupported types.
        if (($msg['type'] ?? '') === 'unsupported' || ! empty($msg['errors'])) {
            Log::info('whatsapp.inbound.unsupported_payload', [
                'type' => $msg['type'] ?? null,
                'msg' => $msg,
            ]);
        }

        $phoneId = $value['metadata']['phone_number_id'] ?? '';
        $fromPhone = $msg['from'] ?? '';

        $channelAccount = ChannelAccount::where('phone_number_id', $phoneId)
            ->where('channel', 'whatsapp')
            ->first();

        if (! $channelAccount) {
            Log::warning('WhatsApp inbound dropped — no channel_account match', [
                'phone_number_id' => $phoneId,
                'from' => $fromPhone,
                'msg_id' => $msg['id'] ?? null,
                'hint' => 'The phone_number_id received from Meta does not exist in channel_accounts. Re-run the WhatsApp setup or verify the configured number id.',
            ]);

            // Skip persisting — without a workspace the message would be invisible
            // and would corrupt the inbox queries that filter by workspace_id.
            throw new \RuntimeException("No channel_account found for phone_number_id={$phoneId}");
        }

        $workspaceId = (int) $channelAccount->workspace_id;

        $contact = $this->contactService->upsert($workspaceId, [
            'phone_e164' => '+'.$fromPhone,
            'opt_in_whatsapp' => true,
            'source' => 'whatsapp_inbound',
        ]);

        $conversation = Conversation::firstOrCreate(
            ['workspace_id' => $workspaceId, 'contact_id' => $contact->id, 'channel_account_id' => $channelAccount?->id],
            ['status' => 'open', 'external_thread_id' => $fromPhone]
        );

        $type = $msg['type'] ?? 'text';
        $interactive = is_array($msg['interactive'] ?? null) ? $msg['interactive'] : [];
        $textBlock = is_array($msg['text'] ?? null) ? $msg['text'] : [];

        // Extract a human-readable body for every message type
        $body = ($textBlock['body'] ?? null)
            ?? (($msg['button'] ?? [])['text'] ?? null)
            ?? (($interactive['button_reply'] ?? [])['title'] ?? null)
            ?? (($interactive['list_reply'] ?? [])['title'] ?? null)
            ?? (is_array($msg[$type] ?? null) && ! isset($msg[$type][0]) ? ($msg[$type]['caption'] ?? null) : null)
            ?? ($msg['caption'] ?? null)
            ?? ($msg['errors'][0]['title'] ?? null);

        // Type-specific body fallbacks so conversation preview is meaningful
        if ($body === null || $body === '') {
            $body = match ($type) {
                'location' => implode(', ', array_filter([
                    $msg['location']['name'] ?? null,
                    $msg['location']['address'] ?? null,
                    isset($msg['location']['latitude'], $msg['location']['longitude'])
                        ? ($msg['location']['latitude'].','.$msg['location']['longitude'])
                        : null,
                ])) ?: '📍 Location',
                'contacts' => isset($msg['contacts'][0]['name']['formatted_name'])
                    ? ('👤 '.$msg['contacts'][0]['name']['formatted_name'])
                    : '👤 Contact',
                'poll' => '📊 '.($msg['poll']['question'] ?? ($msg['interactive']['poll_creation']['name'] ?? 'Poll')),
                'event' => '📅 '.($msg['event']['title'] ?? ($msg['event']['name'] ?? 'Event')),
                'image' => '🖼 Image',
                'video' => '🎬 Video',
                'audio' => '🎤 Audio',
                'document' => '📄 '.($msg['document']['filename'] ?? 'Document'),
                'sticker' => '😊 Sticker',
                'reaction' => $msg['reaction']['emoji'] ?? '👍',
                default => '',
            };
        }

        $allowedTypes = ['text', 'template', 'media', 'interactive', 'reaction', 'image', 'video',
            'document', 'audio', 'location', 'contacts', 'sticker', 'order', 'poll', 'event', 'unsupported'];

        $message = Message::create([
            'conversation_id' => $conversation->id,
            'direction' => 'in',
            'channel' => 'whatsapp',
            'type' => in_array($type, $allowedTypes, true) ? $type : 'unsupported',
            'payload' => $msg,
            'body' => $body,
            'status' => 'delivered',
            'provider_message_id' => $msg['id'] ?? null,
            'sent_by' => 'human',
            'sent_at' => now()->createFromTimestamp($msg['timestamp'] ?? time()),
        ]);

        $conversation->update([
            'last_message_at' => $message->sent_at,
            'status' => 'open',
            'unread_count' => $conversation->unread_count + 1,
            'last_inbound_at' => $message->sent_at,
            // If contact replies after we responded, reset first_response_at for next cycle
            'first_response_at' => $conversation->first_response_at && $conversation->last_inbound_at
                ? ($message->sent_at > $conversation->first_response_at ? null : $conversation->first_response_at)
                : $conversation->first_response_at,
        ]);

        // Fire typed event for automations / AI
        MessageReceived::dispatch($message);

        return $message;
    }

    private function processStatusUpdate(array $status): void
    {
        $providerId = $status['id'] ?? null;
        $newStatus = $status['status'] ?? null;

        if (! $providerId || ! $newStatus) {
            return;
        }

        $statusMap = ['sent' => 'sent', 'delivered' => 'delivered', 'read' => 'read', 'failed' => 'failed'];
        $mapped = $statusMap[$newStatus] ?? null;
        if (! $mapped) {
            return;
        }

        // Status priority — never downgrade (e.g. delivered -> sent).
        $priority = ['queued' => 0, 'sent' => 1, 'delivered' => 2, 'read' => 3, 'failed' => 4];
        $newPriority = $priority[$mapped] ?? 0;

        // 1. Update inbox `messages` row for this wamid.
        $message = Message::where('provider_message_id', $providerId)->first();
        if ($message) {
            $current = $priority[$message->status] ?? 0;
            if ($newPriority >= $current) {
                $message->update(['status' => $mapped]);
                $message->load('conversation');
                MessageStatusUpdated::dispatch($message);
            }
        }

        // 2. Update campaign_recipients row for this wamid (separate table).
        $recipient = CampaignRecipient::where('provider_message_id', $providerId)->first();
        if ($recipient) {
            $current = $priority[$recipient->status] ?? 0;
            if ($newPriority < $current) {
                return;
            }

            $now = now();
            $patch = ['status' => $mapped];

            if ($mapped === 'sent' && ! $recipient->sent_at) {
                $patch['sent_at'] = $now;
            }
            if ($mapped === 'delivered') {
                if (! $recipient->sent_at) {
                    $patch['sent_at'] = $now;
                }
                if (! $recipient->delivered_at) {
                    $patch['delivered_at'] = $now;
                }
            }
            if ($mapped === 'read') {
                if (! $recipient->sent_at) {
                    $patch['sent_at'] = $now;
                }
                if (! $recipient->delivered_at) {
                    $patch['delivered_at'] = $now;
                }
                if (! $recipient->read_at) {
                    $patch['read_at'] = $now;
                }
            }
            if ($mapped === 'failed') {
                $patch['failed_reason'] = substr(
                    $status['errors'][0]['title']
                        ?? $status['errors'][0]['message']
                        ?? 'unknown',
                    0,
                    512,
                );
            }

            $recipient->update($patch);
        }
    }
}
