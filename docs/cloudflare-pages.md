# Cloudflare Pages deploy

## "Local setup required" on the live site

That screen means **`VITE_SUPABASE_URL` and/or `VITE_SUPABASE_ANON_KEY` were missing when Cloudflare ran `npm run build`**.

Vite bakes env vars into the JavaScript at **build time**. A `.env` file in your repo is **not** uploaded to Cloudflare (and should stay gitignored).

### Fix on Cloudflare Pages

1. Open your project in [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → your site
2. **Settings** → **Environment variables**
3. Add for **Production** (and Preview if you use it):

| Name | Example value |
|------|----------------|
| `VITE_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` (anon public key from Supabase) |
| `VITE_TURNSTILE_SITE_KEY` | `0x4AAAA...` (Turnstile site key) |

4. **Deployments** → **Retry deployment** or push a new commit to trigger a rebuild

Until you rebuild, the deployed bundle still has empty config.

Get Supabase values from: Supabase project → **Project Settings** → **API** → Project URL + `anon` `public` key.

---

## Local `.env` (development only)

For `npm run dev` on your machine, the file lives at the **project root** — same folder as `package.json`:

```
web_mastery/
  .env              ← create this (not committed to git)
  .env.example      ← template
  package.json
  src/
  public/
  supabase/
```

Create it:

```bash
npm run setup
```

Then edit `.env` with your real keys and restart `npm run dev`.

If `.env` does not exist yet, that is normal — it is created locally and never deployed.

---

## `_redirects` infinite loop (error 100324)

Do **not** use a catch-all rule like:

```
/* /index.html 200
```

Use route-specific rules in `public/_redirects` instead (see that file), or delete `_redirects` and rely on Cloudflare SPA handling.

## Build settings

| Setting | Value |
|---------|--------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (repo root) |
