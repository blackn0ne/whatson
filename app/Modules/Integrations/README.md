# Integrations Module

Place your Integrations business logic here.

## Structure

```
app/Modules/Integrations/
├── IntegrationsServiceProvider.php   ← register routes & migrations
├── Http/Controllers/            ← Inertia / API controllers
├── Models/                      ← Eloquent models
├── Services/                    ← Business logic
├── Policies/                    ← Gate policies
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── web.php
└── resources/js/Pages/          ← React pages (copy to resources/js/Pages/Integrations)
```

## Registration

Add `App\Modules\Integrations\IntegrationsServiceProvider::class` to the `providers` array in `bootstrap/providers.php`.