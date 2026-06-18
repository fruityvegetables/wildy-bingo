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
      return jsonResponse({ error: 'Username must be 3–20 letters, numbers, or underscores.' }, 400);
    }

    if (typeof password !== 'string' || password.length < 1) {
      return jsonResponse({ error: 'Password is required.' }, 400);
    }

    if (!turnstileToken || !(await verifyTurnstile(turnstileToken, ip))) {
      return jsonResponse({ error: 'Captcha verification failed.' }, 400);
    }

    const admin = createAdminClient();
    const bucket = `signup:${ip ?? 'unknown'}`;
    const allowed = await checkRateLimit(admin, bucket, 5, 3600);
    if (!allowed) {
      return jsonResponse({ error: 'Too many signups. Try again later.' }, 429);
    }

    const normalized = String(username).trim();
    const email = usernameToEmail(normalized);

    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', normalized)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ error: 'Username is already taken.' }, 409);
    }

    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: normalized },
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    const { data: signInData, error: signInError } = await admin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      return jsonResponse({ error: 'Account created but sign-in failed.' }, 500);
    }

    return jsonResponse({
      ok: true,
      session: signInData.session,
      username: normalized,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Signup failed.' }, 500);
  }
});
