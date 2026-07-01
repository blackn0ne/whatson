# Automation Module

Place your Automation business logic here.

## Structure

```
app/Modules/Automation/
├── AutomationServiceProvider.php   ← register routes & migrations
├── Http/Controllers/            ← Inertia / API controllers
├── Models/                      ← Eloquent models
├── Services/                    ← Business logic
├── Policies/                    ← Gate policies
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── web.php
└── resources/js/Pages/          ← React pages (copy to resources/js/Pages/Automation)
```

## Registration

Add `App\Modules\Automation\AutomationServiceProvider::class` to the `providers` array in `bootstrap/providers.php`.