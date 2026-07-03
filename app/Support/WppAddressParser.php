<?php

namespace App\Support;

/**
 * Parse WhatsApp / WPPConnect chat addresses (@c.us, @lid).
 */
class WppAddressParser
{
    /**
     * @param  array<string, mixed>  $event
     * @return array{jid: string, phone_e164: ?string, display_name: ?string}|null
     */
    public static function fromInboundEvent(array $event): ?array
    {
        $from = (string) ($event['from'] ?? $event['chatId'] ?? '');

        if ($from === '') {
            return null;
        }

        $displayName = $event['notifyName']
            ?? $event['senderName']
            ?? (is_array($event['sender'] ?? null) ? ($event['sender']['pushname'] ?? $event['sender']['name'] ?? null) : null)
            ?? $event['name']
            ?? null;

        if (! is_string($displayName)) {
            $displayName = null;
        }

        return self::parseJid($from, $displayName);
    }

    /**
     * @return array{jid: string, phone_e164: ?string, display_name: ?string}|null
     */
    public static function parseJid(string $jid, ?string $displayName = null): ?array
    {
        $jid = trim($jid);

        if ($jid === '' || str_contains($jid, '@g.us') || str_contains($jid, 'status@broadcast')) {
            return null;
        }

        if (preg_match('/^(\d+)@(c\.us|s\.whatsapp\.net)$/i', $jid, $m)) {
            $phone = PhoneNumberNormalizer::normalize('+'.$m[1]);

            return [
                'jid' => strtolower($m[1]).'@'.strtolower($m[2] === 's.whatsapp.net' ? 'c.us' : $m[2]),
                'phone_e164' => $phone,
                'display_name' => $displayName,
            ];
        }

        if (preg_match('/^(\d+)@lid$/i', $jid, $m)) {
            return [
                'jid' => $m[1].'@lid',
                'phone_e164' => null,
                'display_name' => $displayName,
            ];
        }

        $digits = preg_replace('/\D+/', '', $jid) ?? '';
        if ($digits === '') {
            return null;
        }

        $phone = PhoneNumberNormalizer::normalize('+'.$digits);

        return [
            'jid' => $digits.'@c.us',
            'phone_e164' => $phone,
            'display_name' => $displayName,
        ];
    }

    /** Recipient for WPPConnect send-message (`phone` field). */
    public static function toSendAddress(?string $phoneE164, ?string $externalThreadId): string
    {
        if ($externalThreadId !== null && $externalThreadId !== '' && str_contains($externalThreadId, '@')) {
            return $externalThreadId;
        }

        $digits = PhoneNumberNormalizer::toDigits($phoneE164);
        if ($digits === null) {
            throw new \InvalidArgumentException(
                'Cannot send: no valid WhatsApp address. The contact may use a privacy ID (@lid) only.'
            );
        }

        return $digits;
    }

    public static function displayLabel(?string $firstName, ?string $lastName, ?string $phoneE164, ?string $externalThreadId): string
    {
        $name = trim(($firstName ?? '').' '.($lastName ?? ''));
        if ($name !== '') {
            return $name;
        }

        if ($phoneE164) {
            return $phoneE164;
        }

        if ($externalThreadId && str_contains($externalThreadId, '@lid')) {
            $id = explode('@', $externalThreadId)[0];

            return 'WhatsApp ·••'.substr($id, -4);
        }

        if ($externalThreadId) {
            return $externalThreadId;
        }

        return 'Unknown';
    }
}
