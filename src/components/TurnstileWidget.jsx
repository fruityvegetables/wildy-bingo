import { Turnstile } from '@marsidev/react-turnstile';
import { isDemoMode } from '../lib/config.js';

export default function TurnstileWidget({ onToken, onExpire }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  if (isDemoMode()) {
    return (
      <div className="turnstile-wrap turnstile-demo">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onToken('demo-turnstile-token')}
        >
          Demo captcha — click to pass
        </button>
      </div>
    );
  }

  if (!siteKey) {
    return (
      <p className="form-message error">
        Turnstile site key missing. Set VITE_TURNSTILE_SITE_KEY for captcha protection.
      </p>
    );
  }

  return (
    <div className="turnstile-wrap">
      <Turnstile
        siteKey={siteKey}
        onSuccess={onToken}
        onExpire={() => {
          onToken('');
          onExpire?.();
        }}
        options={{ theme: 'dark', size: 'flexible' }}
      />
    </div>
  );
}
