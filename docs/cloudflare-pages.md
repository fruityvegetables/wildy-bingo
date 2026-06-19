# Cloudflare Pages deploy

## `_redirects` infinite loop (error 100324)

Do **not** use a catch-all rule like:

```
/* /index.html 200
```

Cloudflare treats that as an infinite loop because `/index.html` matches `/*` and retriggers the rule.

This project uses **route-specific** rules in `public/_redirects` instead:

```
/host/*  /index.html  200
/play/*  /index.html  200
/dev/*   /index.html  200
```

The home page `/` is served directly by `index.html` with no redirect rule.

If you still see routing issues, you can **delete `public/_redirects` entirely** — Cloudflare Pages auto-handles SPAs when there is no top-level `404.html`.

## Build settings

| Setting | Value |
|---------|--------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (repo root) |

## Environment variables

Set in Pages → Settings → Environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITE_KEY`

Rebuild after changing env vars.
