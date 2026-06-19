# Signup returns 500

A **500** on `POST .../functions/v1/auth-signup` means the Edge Function ran and failed server-side. It is **not** caused by local demo mode (`npm run dev:demo`), which skips the network call entirely.

## Check the response body

In DevTools → Network → the failed `auth-signup` request → **Response**. The JSON `error` field tells you what went wrong.

| `error` | Fix |
|--------|-----|
| `Database schema missing...` | Run `supabase/migrations/001_initial.sql` in Supabase → **SQL Editor** |
| `TURNSTILE_SECRET_KEY is not configured` | Supabase → **Edge Functions** → **Secrets** → add `TURNSTILE_SECRET_KEY` (Turnstile **secret**, not site key) |
| `Account created but sign-in failed.` | Redeploy `auth-signup` after the latest fix (uses anon client for sign-in). Check `detail` in the response. |
| `relation "public.profiles" does not exist` | Same as schema missing — run the migration |

## Required setup checklist

1. **Cloudflare Pages** (build env, then redeploy):
   - `VITE_SUPABASE_URL` = `https://YOUR_REF.supabase.co` (no `/rest/v1`)
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_TURNSTILE_SITE_KEY`
   - Do **not** set `VITE_DEMO_MODE` in production

2. **Supabase secrets** (Dashboard → Edge Functions → Secrets):
   - `TURNSTILE_SECRET_KEY`

3. **Database**: paste and run `supabase/migrations/001_initial.sql`

4. **Edge Functions** deployed with JWT verification off for auth:
   ```bash
   supabase functions deploy auth-signup --no-verify-jwt
   supabase functions deploy auth-login --no-verify-jwt
   ```

## Function logs

Supabase Dashboard → **Edge Functions** → `auth-signup` → **Logs** shows the exact failure if the response body is generic.
