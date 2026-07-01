<?php

use App\Http\Controllers\Api\V1\AiChatbotApiController;
use App\Http\Controllers\Api\V1\AiKnowledgeBaseApiController;
use App\Http\Controllers\Api\V1\AnalyticsApiController;
use App\Http\Controllers\Api\V1\AuditLogApiController;
use App\Http\Controllers\Api\V1\AutomationApiController;
use App\Http\Controllers\Api\V1\CampaignApiController;
use App\Http\Controllers\Api\V1\ContactApiController;
use App\Http\Controllers\Api\V1\ConversationApiController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\MessageApiController;
use App\Http\Controllers\Api\V1\NotificationApiController;
use App\Http\Controllers\Api\V1\OutboundWebhookApiController;
use App\Http\Controllers\Api\V1\SegmentApiController;
use App\Http\Controllers\Api\V1\SocialPostApiController;
use App\Http\Controllers\Api\V1\SubscriptionApiController;
use App\Http\Controllers\Api\V1\TokenController;
use App\Http\Controllers\Api\V1\WorkspaceApiController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — v1
|--------------------------------------------------------------------------
|
| All routes here are prefixed with /api/v1 and guarded by Sanctum.
| Authenticate with: Authorization: Bearer <token>
|
*/

Route::prefix('v1')->middleware(['auth:sanctum', 'throttle:api', 'demo'])->group(function () {

    // ─── Account ─────────────────────────────────────────────────────────────
    Route::get('/me', [MeController::class, 'show']);
    Route::patch('/me', [MeController::class, 'update']);
    Route::get('/workspaces', [WorkspaceApiController::class, 'index']);
    Route::get('/subscription', [SubscriptionApiController::class, 'show']);
    Route::get('/usage', [SubscriptionApiController::class, 'usage']);
    Route::get('/audit-log', [AuditLogApiController::class, 'index']);
    Route::get('/notifications', [NotificationApiController::class, 'index']);
    Route::post('/notifications/{notification}/read', [NotificationApiController::class, 'markRead']);
    Route::get('/tokens', [TokenController::class, 'index']);
    Route::post('/tokens', [TokenController::class, 'store']);
    Route::delete('/tokens/{tokenId}', [TokenController::class, 'destroy']);
    Route::get('/token-scopes', [TokenController::class, 'scopes']);

    // ─── Contacts (contacts:read / contacts:write) ────────────────────────────
    Route::get('/contacts', [ContactApiController::class, 'index'])
        ->middleware('api.ability:contacts:read');
    Route::post('/contacts', [ContactApiController::class, 'store'])
        ->middleware('api.ability:contacts:write');
    Route::get('/contacts/{id}', [ContactApiController::class, 'show'])
        ->middleware('api.ability:contacts:read');
    Route::patch('/contacts/{id}', [ContactApiController::class, 'update'])
        ->middleware('api.ability:contacts:write');
    Route::delete('/contacts/{id}', [ContactApiController::class, 'destroy'])
        ->middleware('api.ability:contacts:write');

    // ─── Segments (contacts:read / contacts:write) ────────────────────────────
    Route::get('/segments', [SegmentApiController::class, 'index'])
        ->middleware('api.ability:contacts:read');
    Route::post('/segments', [SegmentApiController::class, 'store'])
        ->middleware('api.ability:contacts:write');
    Route::get('/segments/{id}/contacts', [SegmentApiController::class, 'contacts'])
        ->middleware('api.ability:contacts:read');

    // ─── Campaigns (campaigns:read / campaigns:write) ─────────────────────────
    Route::get('/campaigns', [CampaignApiController::class, 'index'])
        ->middleware('api.ability:campaigns:read');
    Route::post('/campaigns', [CampaignApiController::class, 'store'])
        ->middleware('api.ability:campaigns:write');
    Route::get('/campaigns/{id}', [CampaignApiController::class, 'show'])
        ->middleware('api.ability:campaigns:read');
    Route::patch('/campaigns/{id}', [CampaignApiController::class, 'update'])
        ->middleware('api.ability:campaigns:write');
    Route::post('/campaigns/{id}/launch', [CampaignApiController::class, 'launch'])
        ->middleware(['api.ability:campaigns:write', 'limit:campaigns_per_month,campaigns']);
    Route::post('/campaigns/{id}/pause', [CampaignApiController::class, 'pause'])
        ->middleware('api.ability:campaigns:write');
    Route::get('/campaigns/{id}/recipients', [CampaignApiController::class, 'recipients'])
        ->middleware('api.ability:campaigns:read');

    // ─── Messages (messages:write) ────────────────────────────────────────────
    Route::post('/messages/send', [MessageApiController::class, 'send'])
        ->middleware(['api.ability:messages:write', 'throttle:60,1']);

    // ─── Conversations (conversations:read) ───────────────────────────────────
    Route::get('/conversations', [ConversationApiController::class, 'index'])
        ->middleware('api.ability:conversations:read');
    Route::get('/conversations/{id}/messages', [ConversationApiController::class, 'messages'])
        ->middleware('api.ability:conversations:read');

    // ─── Outbound Webhooks (webhooks:write) ───────────────────────────────────
    Route::get('/webhooks', [OutboundWebhookApiController::class, 'index'])
        ->middleware('api.ability:webhooks:write');
    Route::post('/webhooks', [OutboundWebhookApiController::class, 'store'])
        ->middleware('api.ability:webhooks:write');
    Route::delete('/webhooks/{id}', [OutboundWebhookApiController::class, 'destroy'])
        ->middleware('api.ability:webhooks:write');

    // ─── AI — Chatbots (ai:read / ai:write) ───────────────────────────────────
    Route::get('/ai/chatbots', [AiChatbotApiController::class, 'index'])
        ->middleware('api.ability:ai:read');
    Route::post('/ai/chatbots/{id}/chat', [AiChatbotApiController::class, 'chat'])
        ->middleware('api.ability:ai:write');

    // ─── AI — Knowledge Bases (ai:read / ai:write) ────────────────────────────
    Route::get('/ai/knowledge-bases', [AiKnowledgeBaseApiController::class, 'index'])
        ->middleware('api.ability:ai:read');
    Route::post('/ai/knowledge-bases', [AiKnowledgeBaseApiController::class, 'store'])
        ->middleware('api.ability:ai:write');
    Route::get('/ai/knowledge-bases/{id}', [AiKnowledgeBaseApiController::class, 'show'])
        ->middleware('api.ability:ai:read');
    Route::post('/ai/knowledge-bases/{id}/documents', [AiKnowledgeBaseApiController::class, 'addDocument'])
        ->middleware('api.ability:ai:write');
    Route::delete('/ai/knowledge-bases/{kbId}/documents/{docId}', [AiKnowledgeBaseApiController::class, 'destroyDocument'])
        ->middleware('api.ability:ai:write');

    // ─── Automations (automations:write) ──────────────────────────────────────
    Route::get('/automations', [AutomationApiController::class, 'index'])
        ->middleware('api.ability:automations:write');
    Route::post('/automations/{id}/trigger', [AutomationApiController::class, 'trigger'])
        ->middleware('api.ability:automations:write');

    // ─── Social (social:write) ────────────────────────────────────────────────
    Route::get('/social/accounts', [SocialPostApiController::class, 'accounts'])
        ->middleware('api.ability:social:write');
    Route::post('/social/posts', [SocialPostApiController::class, 'store'])
        ->middleware(['api.ability:social:write', 'limit:social_posts_per_month,social_posts']);

    // ─── Analytics (analytics:read) ───────────────────────────────────────────
    Route::get('/analytics/messages', [AnalyticsApiController::class, 'messages'])
        ->middleware('api.ability:analytics:read');
    Route::get('/analytics/ai-usage', [AnalyticsApiController::class, 'aiUsage'])
        ->middleware('api.ability:analytics:read');
    Route::get('/analytics/campaign/{campaignId}/funnel', [AnalyticsApiController::class, 'campaignFunnel'])
        ->middleware('api.ability:analytics:read');
    Route::get('/analytics/conversations', [AnalyticsApiController::class, 'conversations'])
        ->middleware('api.ability:analytics:read');
});
