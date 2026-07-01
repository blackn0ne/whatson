<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('channel_accounts', function (Blueprint $table) {
            // Random secret used to route inbound webhooks from unofficial
            // gateways (WPPConnect) that cannot sign their requests. The token is
            // embedded in the webhook URL and mapped back to this channel account.
            // Nullable — official Meta accounts do not use it.
            $table->string('webhook_token', 64)->nullable()->unique()->after('business_account_id');
        });
    }

    public function down(): void
    {
        Schema::table('channel_accounts', function (Blueprint $table) {
            $table->dropUnique(['webhook_token']);
            $table->dropColumn('webhook_token');
        });
    }
};
