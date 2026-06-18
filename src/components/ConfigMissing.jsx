import { getAppConfig } from '../lib/config.js';

export default function ConfigMissing() {
  const config = getAppConfig();

  return (
    <div className="auth-shell">
      <div className="auth-panel stone-panel config-panel">
        <h1 className="auth-title">Local setup required</h1>
        <p className="auth-subtitle">
          The dev server is running, but the app needs environment variables before it can load.
        </p>

        <ol className="config-steps">
          <li>
            Copy <code>.env.example</code> to <code>.env</code> in the project root (or run{' '}
            <code>npm run setup</code>).
          </li>
          <li>
            Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> from
            your Supabase project settings.
          </li>
          <li>
            Add <code>VITE_TURNSTILE_SITE_KEY</code> from Cloudflare Turnstile (needed for
            login/join captcha).
          </li>
          <li>
            Restart the dev server: stop it with Ctrl+C, then run <code>npm run dev</code> again.
          </li>
        </ol>

        <div className="config-status">
          <p className={`form-message ${config.supabaseUrl ? 'success' : 'error'}`}>
            VITE_SUPABASE_URL: {config.supabaseUrl ? 'set' : 'missing'}
          </p>
          <p className={`form-message ${config.supabaseAnonKey ? 'success' : 'error'}`}>
            VITE_SUPABASE_ANON_KEY: {config.supabaseAnonKey ? 'set' : 'missing'}
          </p>
          <p className={`form-message ${config.turnstileSiteKey ? 'success' : 'error'}`}>
            VITE_TURNSTILE_SITE_KEY: {config.turnstileSiteKey ? 'set' : 'missing (captcha)'}
          </p>
        </div>
      </div>
    </div>
  );
}
