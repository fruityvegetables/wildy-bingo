export function getAppConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

  return {
    supabaseUrl,
    supabaseAnonKey,
    turnstileSiteKey,
    isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    hasTurnstile: Boolean(turnstileSiteKey),
  };
}

export function isDemoMode() {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}
