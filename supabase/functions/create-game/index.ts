import {
  checkRateLimit,
  corsPreflight,
  createAdminClient,
  createUserClient,
  jsonResponse,
  verifyTurnstile,
  clientIp,
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

    const body = await req.json();
    const { turnstileToken, name, boardSize, hostGrid, itemText, requireApproval } = body;

    if (!turnstileToken || !(await verifyTurnstile(turnstileToken, ip))) {
      return jsonResponse({ error: 'Captcha verification failed.' }, 400);
    }

    const bucket = `create:${userData.user.id}`;
    const allowed = await checkRateLimit(admin, bucket, 5, 3600);
    if (!allowed) {
      return jsonResponse({ error: 'Too many games created. Try again later.' }, 429);
    }

    const { data, error } = await userClient.rpc('create_game', {
      p_name: name ?? 'Wilderness Bingo',
      p_board_size: boardSize,
      p_host_grid: hostGrid,
      p_item_text: itemText ?? '',
      p_require_approval: requireApproval ?? false,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ ok: true, game: data });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Create game failed.' }, 500);
  }
});
