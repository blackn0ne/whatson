# Whatsapp Module

Place your Whatsapp business logic here.

## Structure

```
app/Modules/Whatsapp/
├── WhatsappServiceProvider.php   ← register routes & migrations
├── Http/Controllers/            ← Inertia / API controllers
├── Models/                      ← Eloquent models
├── Services/                    ← Business logic
├── Policies/                    ← Gate policies
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── web.php
└── resources/js/Pages/          ← React pages (copy to resources/js/Pages/Whatsapp)
```

## Registration

Add `App\Modules\Whatsapp\WhatsappServiceProvider::class` to the `providers` array in `bootstrap/providers.php`.