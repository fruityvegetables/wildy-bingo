import {
  USERNAME_RE,
  checkRateLimit,
  clientIp,
  corsPreflight,
  createAdminClient,
  jsonResponse,
  usernameToEmail,
  verifyTurnstile,
} from '../_shared/utils.ts';

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
    const bucket = `login:${ip ?? 'unknown'}`;
    const allowed = await checkRateLimit(admin, bucket, 10, 900);
    if (!allowed) {
      return jsonResponse({ error: 'Too many login attempts. Try again later.' }, 429);
    }

    const email = usernameToEmail(String(username).trim());
    const { data, error } = await admin.auth.signInWithPassword({ email, password });

    if (error) {
      return jsonResponse({ error: 'Invalid username or password.' }, 401);
    }

    return jsonResponse({
      ok: true,
      session: data.session,
      username: data.user?.user_metadata?.username ?? String(username).trim(),
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Login failed.' }, 500);
  }
});
