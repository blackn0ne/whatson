# Social Module

Place your Social business logic here.

## Structure

```
app/Modules/Social/
├── SocialServiceProvider.php   ← register routes & migrations
├── Http/Controllers/            ← Inertia / API controllers
├── Models/                      ← Eloquent models
├── Services/                    ← Business logic
├── Policies/                    ← Gate policies
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── web.php
└── resources/js/Pages/          ← React pages (copy to resources/js/Pages/Social)
```

## Registration

Add `App\Modules\Social\SocialServiceProvider::class` to the `providers` array in `bootstrap/providers.php`.