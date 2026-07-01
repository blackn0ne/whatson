# Ecommerce Module

Place your Ecommerce business logic here.

## Structure

```
app/Modules/Ecommerce/
├── EcommerceServiceProvider.php   ← register routes & migrations
├── Http/Controllers/            ← Inertia / API controllers
├── Models/                      ← Eloquent models
├── Services/                    ← Business logic
├── Policies/                    ← Gate policies
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── web.php
└── resources/js/Pages/          ← React pages (copy to resources/js/Pages/Ecommerce)
```

## Registration

Add `App\Modules\Ecommerce\EcommerceServiceProvider::class` to the `providers` array in `bootstrap/providers.php`.