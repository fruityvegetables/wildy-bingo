# Signup 404 on Supabase URL

Sign up calls:

```
POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-signup
```

A **404** means that URL path does not exist — not a wrong password or captcha issue.

## Fix 1: Deploy Edge Functions (most common)

The frontend calls **Edge Functions**, not Supabase Auth directly. You must deploy them:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

npx supabase secrets set TURNSTILE_SECRET_KEY=your_turnstile_secret

npx supabase functions deploy auth-signup --no-verify-jwt
npx supabase functions deploy auth-login --no-verify-jwt
npx supabase functions deploy create-game
npx supabase functions deploy join-game
```

`--no-verify-jwt` is required for signup/login (user has no token yet).

### Verify in browser or terminal

Replace `YOUR_REF` with your project ref:

```bash
curl -i "https://YOUR_REF.supabase.co/functions/v1/auth-signup" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d "{\"username\":\"test\",\"password\":\"test\",\"turnstileToken\":\"test\"}"
```

| Response | Meaning |
|----------|---------|
| **404** | Function not deployed (or wrong project URL) |
| **400** captcha failed | Function exists — good |
| **401** | Deploy with `--no-verify-jwt` for auth-signup |

## Fix 2: Correct `VITE_SUPABASE_URL` on Cloudflare Pages

In **Cloudflare Pages → Settings → Environment variables**:

```
VITE_SUPABASE_URL=https://slxueatxsdxnnxtkrmfn.supabase.co
```

Must be the **Project URL only** — no path suffix.

| Wrong (404) | Right |
|-------------|-------|
| `https://xxx.supabase.co/rest/v1` | `https://xxx.supabase.co` |

If the env var includes `/rest/v1`, the app calls:

```
https://xxx.supabase.co/rest/v1/functions/v1/auth-signup   ← 404
```

It should call:

```
https://xxx.supabase.co/functions/v1/auth-signup
```

Fix the env var and **redeploy**.

## Fix 3: Same Supabase project everywhere

The URL in Cloudflare must match the project where you deployed functions:

- Cloudflare `VITE_SUPABASE_URL` → project A  
- `supabase link` + `functions deploy` → project B  

→ 404 on project A because functions live on B.

## Quick checklist

- [ ] `curl` to `/functions/v1/auth-signup` returns 400, not 404  
- [ ] `VITE_SUPABASE_URL` is `https://<ref>.supabase.co`  
- [ ] Cloudflare rebuild after env var change  
- [ ] `auth-signup` deployed with `--no-verify-jwt`  
- [ ] `TURNSTILE_SECRET_KEY` set in Supabase secrets  

## Network tab tip

In DevTools → **Network**, click the failed request and check **Request URL**. It should look exactly like:

```
https://xxxxxxxx.supabase.co/functions/v1/auth-signup
```

If you see `demo.local`, `YOUR_PROJECT`, or `undefined` — fix Cloudflare env vars and redeploy.
