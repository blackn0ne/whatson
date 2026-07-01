# AI Module

Place your AI business logic here.

## Structure

```
app/Modules/AI/
├── AIServiceProvider.php   ← register routes & migrations
├── Http/Controllers/            ← Inertia / API controllers
├── Models/                      ← Eloquent models
├── Services/                    ← Business logic
├── Policies/                    ← Gate policies
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── web.php
└── resources/js/Pages/          ← React pages (copy to resources/js/Pages/AI)
```

## Registration

Add `App\Modules\AI\AIServiceProvider::class` to the `providers` array in `bootstrap/providers.php`.