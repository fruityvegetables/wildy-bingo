import { createClient } from 'npm:@supabase/supabase-js@2';

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

function createUserClient(authHeader: string | null) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    }
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
    const authHeader = req.headers.get('Authorization');
    const userClient = createUserClient(authHeader);
    const admin = createAdminClient();
    const ip = clientIp(req);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const body = await req.json();
    const { turnstileToken, name, boardSize, hostGrid, itemText, requireApproval } = body;

    if (!turnstileToken || !(await verifyTurnstile(turnstileToken, ip))) {
      return jsonResponse({ error: 'Captcha verification failed.' }, 400);
    }

    const allowed = await checkRateLimit(admin, `create:${userData.user.id}`, 5, 3600);
    if (!allowed) return jsonResponse({ error: 'Too many games created. Try again later.' }, 429);

    const { data, error } = await userClient.rpc('create_game', {
      p_name: name ?? 'Wilderness Bingo',
      p_board_size: boardSize,
      p_host_grid: hostGrid,
      p_item_text: itemText ?? '',
      p_require_approval: requireApproval ?? false,
    });

    if (error) return jsonResponse({ error: error.message }, 400);

    return jsonResponse({ ok: true, game: data });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Create game failed.' }, 500);
  }
});
