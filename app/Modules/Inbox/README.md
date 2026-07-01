# Inbox Module

Place your Inbox business logic here.

## Structure

```
app/Modules/Inbox/
├── InboxServiceProvider.php   ← register routes & migrations
├── Http/Controllers/            ← Inertia / API controllers
├── Models/                      ← Eloquent models
├── Services/                    ← Business logic
├── Policies/                    ← Gate policies
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── web.php
└── resources/js/Pages/          ← React pages (copy to resources/js/Pages/Inbox)
```

## Registration

Add `App\Modules\Inbox\InboxServiceProvider::class` to the `providers` array in `bootstrap/providers.php`.