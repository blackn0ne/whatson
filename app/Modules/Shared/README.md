# Shared Module

Place your Shared business logic here.

## Structure

```
app/Modules/Shared/
├── SharedServiceProvider.php   ← register routes & migrations
├── Http/Controllers/            ← Inertia / API controllers
├── Models/                      ← Eloquent models
├── Services/                    ← Business logic
├── Policies/                    ← Gate policies
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── web.php
└── resources/js/Pages/          ← React pages (copy to resources/js/Pages/Shared)
```

## Registration

Add `App\Modules\Shared\SharedServiceProvider::class` to the `providers` array in `bootstrap/providers.php`.