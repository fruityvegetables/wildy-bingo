import { createClient } from 'npm:@supabase/supabase-js@2';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@wilderness-bingo.app`;
}

function clientIp(req: Request) {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for');
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function createAnonClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );
}

function dbSetupHint(message: string) {
  if (/relation .* does not exist/i.test(message) || message.includes('42P01')) {
    return 'Database schema missing. Run supabase/migrations/001_initial.sql in the Supabase SQL editor.';
  }
  return message;
}

function turnstileErrorMessage(errors: string[]) {
  if (errors.includes('invalid-input-secret')) {
    return 'Captcha misconfigured: TURNSTILE_SECRET_KEY must match the same Turnstile widget as VITE_TURNSTILE_SITE_KEY.';
  }
  if (errors.includes('timeout-or-duplicate')) {
    return 'Captcha expired or already used. Complete captcha again, then submit immediately.';
  }
  if (errors.includes('invalid-input-response')) {
    return 'Captcha token invalid. Refresh the captcha and try again.';
  }
  return 'Captcha verification failed.';
}

async function verifyTurnstile(token: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY is not configured');

  const body = new URLSearchParams({ secret, response: token });

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const result = await response.json();
  const errors: string[] = result['error-codes'] ?? [];
  return { ok: result.success === true, errors };
}

async function checkRateLimit(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  maxEvents: number,
  windowSeconds: number
) {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await admin
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .gte('created_at', since);

  if (error) throw error;
  if ((count ?? 0) >= maxEvents) return false;

  await admin.from('rate_limit_events').insert({ bucket });
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();

  try {
    const { username, password, turnstileToken } = await req.json();
    const ip = clientIp(req);

    if (!USERNAME_RE.test(String(username ?? ''))) {
      return jsonResponse({ error: 'Username must be 3–20 letters, numbers, or underscores.' }, 400);
    }

    if (typeof password !== 'string' || password.length < 1) {
      return jsonResponse({ error: 'Password is required.' }, 400);
    }

    if (!turnstileToken) {
      return jsonResponse({ error: 'Complete the captcha first.' }, 400);
    }

    const captcha = await verifyTurnstile(turnstileToken);
    if (!captcha.ok) {
      return jsonResponse(
        { error: turnstileErrorMessage(captcha.errors), turnstileErrors: captcha.errors },
        400
      );
    }

    const admin = createAdminClient();
    const allowed = await checkRateLimit(admin, `signup:${ip ?? 'unknown'}`, 5, 3600);
    if (!allowed) return jsonResponse({ error: 'Too many signups. Try again later.' }, 429);

    const normalized = String(username).trim();
    const email = usernameToEmail(normalized);

    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', normalized)
      .maybeSingle();

    if (existing) return jsonResponse({ error: 'Username is already taken.' }, 409);

    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: normalized },
    });

    if (error) return jsonResponse({ error: error.message }, 400);

    const anon = createAnonClient();
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      return jsonResponse(
        {
          error: 'Account created but sign-in failed.',
          detail: signInError?.message ?? 'No session returned.',
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      session: signInData.session,
      username: normalized,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signup failed.';
    return jsonResponse({ error: dbSetupHint(message) }, 500);
  }
});
