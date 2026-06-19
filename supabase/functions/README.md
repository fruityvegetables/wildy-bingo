# Deploying Edge Functions

Each function is a **single self-contained `index.ts`** file (no `_shared` imports). This avoids Supabase bundler "Module not found" errors.

## Prerequisites

1. Run the SQL migration in `supabase/migrations/` (if present) in the Supabase SQL editor.
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and log in:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

3. Set secrets:

```bash
npx supabase secrets set TURNSTILE_SECRET_KEY=your_turnstile_secret
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in Edge Functions.

## Deploy

Deploy all four functions:

```bash
npx supabase functions deploy auth-signup
npx supabase functions deploy auth-login
npx supabase functions deploy create-game
npx supabase functions deploy join-game
```

Or deploy in one line:

```bash
npx supabase functions deploy auth-signup && npx supabase functions deploy auth-login && npx supabase functions deploy create-game && npx supabase functions deploy join-game
```

## If deploy still fails

- Update the CLI: `npm install -g supabase@latest`
- Deploy one function and read the full error: `npx supabase functions deploy auth-signup --debug`
- Do **not** use `https://esm.sh/...` imports — use `npm:@supabase/supabase-js@2` only (already set in these files)
- Do **not** import from `../_shared/` — shared code is inlined per function

## Verify

```bash
curl -i https://YOUR_PROJECT.supabase.co/functions/v1/auth-login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test","turnstileToken":"test"}'
```

Expect `400` captcha failure (not `404` or bundle error).
