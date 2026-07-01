<?php

namespace App\Http\Controllers\Client;

use App\Contracts\BillingGatewayInterface;
use App\Http\Controllers\Controller;
use App\Models\PaymentTransaction;
use App\Services\Billing\BillingGatewayRegistry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class BillingController extends Controller
{
    public function __construct(
        private BillingGatewayRegistry $gateways
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        // When returning from Stripe success URL with session_id, create subscription + transaction (webhooks may not reach localhost).
        // Guarded: the webhook may fulfil the same session concurrently, and the unique (gateway, gateway_transaction_id)
        // / (gateway, gateway_subscription_id) constraints would otherwise let a race surface as a 500 on this page.
        $sessionId = $request->query('session_id');
        if ($sessionId && $user) {
            $stripe = $this->gateways->get('stripe');
            if ($stripe instanceof BillingGatewayInterface) {
                try {
                    $stripe->fulfillCheckoutSession($sessionId);
                } catch (\Throwable $e) {
                    // Already fulfilled by the webhook (or a transient gateway error) — the billing
                    // list below still renders; never fail the page over fulfilment.
                    Log::warning('Billing: checkout fulfilment skipped', [
                        'user_id' => $user->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        $query = PaymentTransaction::where('user_id', $user->id)
            ->with(['subscription.plan:id,name,slug'])
            ->orderByDesc('created_at');

        $transactions = $query->paginate(20)->withQueryString()->through(function ($t) {
            return [
                'id' => $t->id,
                'amount_cents' => $t->amount_cents,
                'currency_code' => $t->currency_code,
                'status' => $t->status,
                'gateway' => $t->gateway,
                'created_at' => $t->created_at->toIso8601String(),
                'plan' => $t->subscription?->plan ? [
                    'name' => $t->subscription->plan->name,
                ] : null,
            ];
        });

        return Inertia::render('client/Billing/Index', [
            'transactions' => $transactions,
        ]);
    }
}
