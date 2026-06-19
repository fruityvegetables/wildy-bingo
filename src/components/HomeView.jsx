import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import TurnstileWidget from './TurnstileWidget.jsx';
import { edgeFunctions } from '../utils/gameApi.js';
import { initGrid } from '../utils/bingo.js';

export default function HomeView() {
  const { username, logOut } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [gameName, setGameName] = useState('Wilderness Bingo');
  const [requireApproval, setRequireApproval] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null);

  const resetCaptcha = () => setTurnstileToken('');

  const handleCreateGame = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!turnstileToken) {
      setMessage({ type: 'error', text: 'Complete the captcha first.' });
      return;
    }

    setBusy(true);
    const result = await edgeFunctions.createGame({
      turnstileToken,
      name: gameName,
      boardSize: 5,
      hostGrid: initGrid(5),
      itemText: '',
      requireApproval,
    });
    setBusy(false);
    resetCaptcha();

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error || 'Could not create game.' });
      return;
    }

    navigate(`/host/${result.game.id}`);
  };

  const handleJoinGame = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!joinCode.trim()) {
      setMessage({ type: 'error', text: 'Enter a join code.' });
      return;
    }

    if (!turnstileToken) {
      setMessage({ type: 'error', text: 'Complete the captcha first.' });
      return;
    }

    setBusy(true);
    const result = await edgeFunctions.joinGame(joinCode.trim(), turnstileToken);
    setBusy(false);
    resetCaptcha();

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error || 'Could not join game.' });
      return;
    }

    navigate(`/play/${result.player.game_id}`);
  };

  return (
    <div className="app-shell">
      <header className="app-header stone-panel">
        <div className="header-brand">
          <span className="skull-icon" aria-hidden="true">
            ☠
          </span>
          <div>
            <h1>Wildy Bingo</h1>
            <p className="header-tagline">Multiplayer · private join codes</p>
          </div>
        </div>
        <div className="header-actions">
          <span className="user-chip">{username}</span>
          <button type="button" className="btn btn-danger" onClick={logOut}>
            Log Out
          </button>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero stone-panel">
          <h2>Host or join a match</h2>
          <p className="hint">
            Hosts build the board, share a private code, then start the match. Boards lock permanently
            and tile marking updates in realtime.
          </p>

          <div className="home-actions">
            <button
              type="button"
              className={`btn btn-primary ${mode === 'host' ? 'btn-active' : ''}`}
              onClick={() => {
                setMode('host');
                resetCaptcha();
                setMessage({ type: '', text: '' });
              }}
            >
              Host a Game
            </button>
            <button
              type="button"
              className={`btn btn-secondary ${mode === 'join' ? 'btn-active' : ''}`}
              onClick={() => {
                setMode('join');
                resetCaptcha();
                setMessage({ type: '', text: '' });
              }}
            >
              Join with Code
            </button>
          </div>
        </section>

        {mode === 'host' && (
          <section className="home-form-panel stone-panel">
            <h3>Host setup</h3>
            <form className="home-form" onSubmit={handleCreateGame}>
              <label>
                Game name
                <input
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="Wildy Bingo"
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                />
                Require host approval before players can join
              </label>
              <TurnstileWidget onToken={setTurnstileToken} onExpire={resetCaptcha} />
              <button type="submit" className="btn btn-primary" disabled={busy || !turnstileToken}>
                {busy ? 'Creating…' : 'Create Game & Set Up Board'}
              </button>
            </form>
          </section>
        )}

        {mode === 'join' && (
          <section className="home-form-panel stone-panel">
            <h3>Join a game</h3>
            <form className="home-form" onSubmit={handleJoinGame}>
              <label>
                Private join code
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="WLD123"
                  maxLength={6}
                />
              </label>
              <TurnstileWidget onToken={setTurnstileToken} onExpire={resetCaptcha} />
              <button type="submit" className="btn btn-primary" disabled={busy || !turnstileToken}>
                {busy ? 'Joining…' : 'Join Game'}
              </button>
            </form>
          </section>
        )}

        {message.text && (
          <p className={`form-message ${message.type} home-message`}>{message.text}</p>
        )}
      </main>
    </div>
  );
}
