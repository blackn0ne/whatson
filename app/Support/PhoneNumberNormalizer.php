<?php

namespace App\Support;

/**
 * Normalize phone numbers to E.164 (+XXXXXXXX) for storage and sending.
 */
class PhoneNumberNormalizer
{
    /**
     * @return string|null E.164 or null if invalid
     */
    public static function normalize(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        $raw = trim($raw);
        if ($raw === '' || preg_match('/phone/i', $raw)) {
            return null;
        }

        $p = preg_replace('/[\s\-().]/', '', $raw);
        if ($p === '') {
            return null;
        }

        if (str_starts_with($p, '00')) {
            $p = '+'.substr($p, 2);
        } elseif (! str_starts_with($p, '+')) {
            $digits = preg_replace('/\D+/', '', $p) ?? '';
            if ($digits === '') {
                return null;
            }

            // Kazakhstan: 8XXXXXXXXXX → +7XXXXXXXXXX
            if (strlen($digits) === 11 && str_starts_with($digits, '8')) {
                $p = '+7'.substr($digits, 1);
            } elseif (strlen($digits) === 10 && str_starts_with($digits, '7')) {
                $p = '+'.$digits;
            } else {
                $p = '+'.$digits;
            }
        }

        if (! preg_match('/^\+\d{10,15}$/', $p)) {
            return null;
        }

        // Kazakhstan mobile: +7 + exactly 10 digits
        if (preg_match('/^\+7(\d+)$/', $p, $m)) {
            $national = $m[1];
            if (strlen($national) !== 10) {
                return null;
            }
            if (! preg_match('/^[67]\d{9}$/', $national)) {
                return null;
            }
        }

        return $p;
    }

    /** Digits only, no "+", for WPPConnect / SMS APIs. */
    public static function toDigits(?string $e164): ?string
    {
        $normalized = self::normalize($e164);

        return $normalized !== null ? ltrim($normalized, '+') : null;
    }

    public static function friendlySendError(string $raw): string
    {
        $lower = strtolower($raw);

        if (str_contains($lower, 'não existe') || str_contains($lower, 'not exist') || str_contains($lower, 'invalid number')) {
            return 'Номер не зарегистрирован в WhatsApp или указан неверно. Используйте формат +77001234567';
        }

        if (str_contains($lower, 'privacy id') || str_contains($lower, '@lid')) {
            return 'Не удалось отправить: у контакта скрытый WhatsApp ID. Дождитесь нового сообщения от клиента.';
        }

        if (str_contains($lower, 'wppconnect send-message failed')) {
            if (preg_match('/"message"\s*:\s*"([^"]+)"/u', $raw, $m)) {
                return self::friendlySendError($m[1]);
            }
        }

        return $raw;
    }
}
