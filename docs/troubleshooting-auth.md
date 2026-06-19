# Turnstile / login button issues

## The `challenges.cloudflare.com` … `/pat/` … **401** (ignore this)

If DevTools shows:

```
GET https://challenges.cloudflare.com/cdn-cgi/challenge-platform/.../pat/...
Status: 401 Unauthorized
```

**This is normal.** Cloudflare documents it as expected Turnstile behavior — the widget probes for a **Private Access Token** your browser may not support yet. The PAT request returns 401; Turnstile continues via other challenge paths (often `/img/` with 200).

You do **not** fix this in Supabase or your backend. Per [Cloudflare Turnstile error codes](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/): if the widget completes and you get a token, no action is required.

Console may also say:

> Request for the Private Access Token challenge. The next request … may return a 401 …

That warning is expected too.

### What to check instead

| Network request | What it means |
|-----------------|---------------|
| `challenges.cloudflare.com/.../pat/...` **401** | Harmless — ignore |
| `challenges.cloudflare.com/.../img/...` **200** | Challenge UI loaded |
| **`YOUR_REF.supabase.co/functions/v1/auth-signup`** | Your actual signup — inspect this for real errors |

The login button only enables when Turnstile calls **`onSuccess`** with a token. The PAT 401 does not block that by itself.

---

## Login button stays disabled

```jsx
disabled={busy || !turnstileToken}
```

The button waits for `onSuccess`, not for the PAT request.

### Real causes

1. **Hostname not allowed** — Turnstile dashboard → your widget → **Hostname Management**. Add:
   - `your-project.pages.dev`
   - Custom domain (apex and `www` if used)
   - `localhost` for local dev

2. **Widget looks done but no token** — Green check from `/img/` can appear while `onSuccess` never fires (hostname mismatch, ad blocker, or widget error). Check Console for Turnstile **error codes** (e.g. `110200` = domain not authorized).

3. **Token cleared after failed submit** — Complete captcha again after any error. The widget should reset automatically.

4. **Ad blockers / Brave shields** — Disable on your site temporarily.

5. **Site key missing at build time** — Set `VITE_TURNSTILE_SITE_KEY` in Cloudflare Pages → **Retry deployment**.

---

## Server-side Turnstile verification (after submit)

Site key (Pages) and secret (Supabase) must be from the **same** Turnstile widget:

| Where | Variable |
|-------|----------|
| Cloudflare Pages | `VITE_TURNSTILE_SITE_KEY` |
| Supabase secrets | `TURNSTILE_SECRET_KEY` |

```bash
npx supabase secrets set TURNSTILE_SECRET_KEY=your_secret_key
npx supabase functions deploy auth-signup --no-verify-jwt
npx supabase functions deploy auth-login --no-verify-jwt
```

Failed server verification returns **400** with `turnstileErrors` (e.g. `invalid-input-secret`, `timeout-or-duplicate`).

---

## Supabase 401 (different request entirely)

Only applies to requests to **`*.supabase.co/functions/v1/...`**, not `challenges.cloudflare.com`.

| Status | Meaning |
|--------|---------|
| **400** + captcha message | Server rejected Turnstile token |
| **401** on **login** | Wrong username/password |
| **401** `Invalid JWT` on signup | Gateway blocked request — deploy auth functions with `--no-verify-jwt`; do not send anon key in `Authorization` header |

---

## Local development

`.env` at project root:

```
VITE_TURNSTILE_SITE_KEY=0x...
```

Add `localhost` to Turnstile hostnames.
