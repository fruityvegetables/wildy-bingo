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

async function verifyTurnstile(token: string, ip?: string | null) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY is not configured');

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const result = await response.json();
  return result.success === true;
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
      return jsonResponse({ error: 'Invalid username.' }, 400);
    }

    if (typeof password !== 'string' || password.length < 1) {
      return jsonResponse({ error: 'Password is required.' }, 400);
    }

    if (!turnstileToken || !(await verifyTurnstile(turnstileToken, ip))) {
      return jsonResponse({ error: 'Captcha verification failed.' }, 400);
    }

    const admin = createAdminClient();
    const allowed = await checkRateLimit(admin, `login:${ip ?? 'unknown'}`, 10, 900);
    if (!allowed) return jsonResponse({ error: 'Too many login attempts. Try again later.' }, 429);

    const email = usernameToEmail(String(username).trim());
    const { data, error } = await admin.auth.signInWithPassword({ email, password });

    if (error) return jsonResponse({ error: 'Invalid username or password.' }, 401);

    return jsonResponse({
      ok: true,
      session: data.session,
      username: data.user?.user_metadata?.username ?? String(username).trim(),
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Login failed.' }, 500);
  }
});
