# Broadcasting Module

Place your Broadcasting business logic here.

## Structure

```
app/Modules/Broadcasting/
├── BroadcastingServiceProvider.php   ← register routes & migrations
├── Http/Controllers/            ← Inertia / API controllers
├── Models/                      ← Eloquent models
├── Services/                    ← Business logic
├── Policies/                    ← Gate policies
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── web.php
└── resources/js/Pages/          ← React pages (copy to resources/js/Pages/Broadcasting)
```

## Registration

Add `App\Modules\Broadcasting\BroadcastingServiceProvider::class` to the `providers` array in `bootstrap/providers.php`.