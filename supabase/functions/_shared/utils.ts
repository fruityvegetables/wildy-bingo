import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function verifyTurnstile(token: string, ip?: string | null) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    throw new Error('TURNSTILE_SECRET_KEY is not configured');
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  if (ip) body.set('remoteip', ip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const result = await response.json();
  return result.success === true;
}

export async function checkRateLimit(
  supabaseAdmin: SupabaseClient,
  bucket: string,
  maxEvents: number,
  windowSeconds: number
) {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await supabaseAdmin
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .gte('created_at', since);

  if (error) throw error;
  if ((count ?? 0) >= maxEvents) {
    return false;
  }

  await supabaseAdmin.from('rate_limit_events').insert({ bucket });
  return true;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

export function createUserClient(authHeader: string | null) {
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

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@wilderness-bingo.app`;
}

export function clientIp(req: Request) {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for');
}
