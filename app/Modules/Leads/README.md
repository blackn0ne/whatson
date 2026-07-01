# Leads Module

Place your Leads business logic here.

## Structure

```
app/Modules/Leads/
├── LeadsServiceProvider.php   ← register routes & migrations
├── Http/Controllers/            ← Inertia / API controllers
├── Models/                      ← Eloquent models
├── Services/                    ← Business logic
├── Policies/                    ← Gate policies
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── web.php
└── resources/js/Pages/          ← React pages (copy to resources/js/Pages/Leads)
```

## Registration

Add `App\Modules\Leads\LeadsServiceProvider::class` to the `providers` array in `bootstrap/providers.php`.