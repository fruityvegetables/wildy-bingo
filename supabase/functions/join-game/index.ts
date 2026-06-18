import {
  checkRateLimit,
  clientIp,
  corsPreflight,
  createAdminClient,
  createUserClient,
  jsonResponse,
  verifyTurnstile,
} from '../_shared/utils.ts';

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

    const { joinCode, turnstileToken } = await req.json();

    if (!turnstileToken || !(await verifyTurnstile(turnstileToken, ip))) {
      return jsonResponse({ error: 'Captcha verification failed.' }, 400);
    }

    const bucket = `join:${userData.user.id}`;
    const allowed = await checkRateLimit(admin, bucket, 10, 900);
    if (!allowed) {
      return jsonResponse({ error: 'Too many join attempts. Try again later.' }, 429);
    }

    const { data, error } = await userClient.rpc('join_game', {
      p_join_code: String(joinCode ?? '').trim(),
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ ok: true, player: data });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Join failed.' }, 500);
  }
});
