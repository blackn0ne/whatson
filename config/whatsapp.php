<?php

return [

    /*
    |--------------------------------------------------------------------------
    | WhatsApp providers
    |--------------------------------------------------------------------------
    |
    | The application supports two WhatsApp delivery providers:
    |
    |   - "meta"        Official WhatsApp Business Cloud API (graph.facebook.com)
    |   - "wppconnect"  Unofficial self-hosted gateway (WPPConnect Server), which
    |                   drives WhatsApp Web. Connected by scanning a QR code.
    |
    | Each connected number is stored as a ChannelAccount whose `provider` column
    | selects which gateway is used for sending / receiving. This file only holds
    | the connection details for the self-hosted WPPConnect Server; official Meta
    | credentials continue to live on the WhatsappBusinessAccount model.
    |
    */

    'wppconnect' => [
        // Base URL of the WPPConnect Server (no trailing slash), e.g. http://127.0.0.1:21465
        'base_url' => rtrim((string) env('WPPCONNECT_BASE_URL', 'http://127.0.0.1:21465'), '/'),

        // The SECRET_KEY configured on the WPPConnect Server. Used to generate
        // per-session bearer tokens via /api/{session}/{secret}/generate-token.
        'secret_key' => env('WPPCONNECT_SECRET_KEY', ''),

        // HTTP timeout (seconds) for routine gateway requests (send, status, …).
        'timeout' => (int) env('WPPCONNECT_TIMEOUT', 30),

        // Only used when start-session is called with waitQrCode=true (not the
        // default). Chromium + QR on a VPS can take 60–120s.
        'start_timeout' => (int) env('WPPCONNECT_START_TIMEOUT', 120),

        // Verify TLS certificate when calling the gateway. Disable only for local
        // development against a self-signed / plain-HTTP gateway.
        'verify_ssl' => filter_var(env('WPPCONNECT_VERIFY_SSL', true), FILTER_VALIDATE_BOOL),

        // Delay between consecutive bulk sends (milliseconds). Unofficial numbers
        // are far more likely to be banned when blasting messages, so campaigns
        // throttle themselves by this amount.
        'bulk_delay_ms' => (int) env('WPPCONNECT_BULK_DELAY_MS', 2000),
    ],

];
