import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import TurnstileWidget from './TurnstileWidget.jsx';
import { isValidUsername } from '../utils/username.js';

const MODES = {
  login: { title: 'Enter the Wilderness', submit: 'Log In' },
  signup: { title: 'Register Scout', submit: 'Sign Up' },
};

export default function AuthForm() {
  const { signUp, logIn } = useAuth();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const clearForm = () => {
    setPassword('');
    setTurnstileToken('');
    setMessage({ type: '', text: '' });
  };

  const switchMode = (next) => {
    setMode(next);
    clearForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!isValidUsername(username)) {
      setMessage({
        type: 'error',
        text: 'Username must be 3–20 characters (letters, numbers, underscores).',
      });
      return;
    }

    if (!turnstileToken) {
      setMessage({ type: 'error', text: 'Complete the captcha first.' });
      return;
    }

    setBusy(true);
    const result =
      mode === 'login'
        ? await logIn(username, password, turnstileToken)
        : await signUp(username, password, turnstileToken);
    setBusy(false);

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error || 'Request failed.' });
      setTurnstileToken('');
    }
  };

  const { title, submit } = MODES[mode];

  return (
    <div className="auth-shell">
      <div className="auth-panel stone-panel">
        <div className="wildy-badge">Lvl 56</div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">Username + password · protected by Turnstile</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="wildy_scout"
              autoComplete="username"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Any text works"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          <TurnstileWidget onToken={setTurnstileToken} onExpire={() => setTurnstileToken('')} />

          {message.text && (
            <p className={`form-message ${message.type}`}>{message.text}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy || !turnstileToken}>
            {busy ? 'Working…' : submit}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'login' ? (
            <button type="button" className="link-btn" onClick={() => switchMode('signup')}>
              Create account
            </button>
          ) : (
            <button type="button" className="link-btn" onClick={() => switchMode('login')}>
              Already registered? Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
