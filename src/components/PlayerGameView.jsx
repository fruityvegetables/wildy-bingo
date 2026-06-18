import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BingoBoard from './BingoBoard.jsx';
import {
  fetchGame,
  fetchGamePlayers,
  fetchTileMarks,
  marksToSet,
  subscribeToGame,
  toggleTileMark,
} from '../utils/gameApi.js';

export default function PlayerGameView({ demoGameId }) {
  const { gameId: routeGameId } = useParams();
  const gameId = demoGameId ?? routeGameId;
  const { username, userId } = useAuth();
  const [game, setGame] = useState(null);
  const [player, setPlayer] = useState(null);
  const [marked, setMarked] = useState(() => new Set());
  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadAll = useCallback(async () => {
    const [gameRes, playersRes] = await Promise.all([fetchGame(gameId), fetchGamePlayers(gameId)]);

    if (!gameRes.ok) {
      setMsg({ type: 'error', text: gameRes.error });
      return;
    }

    setGame(gameRes.game);

    if (!playersRes.ok) return;

    const me = playersRes.players.find((p) => p.user_id === userId);
    if (!me) {
      setMsg({ type: 'error', text: 'You are not in this game.' });
      return;
    }

    if (me.status === 'kicked') {
      setMsg({ type: 'error', text: 'You were removed from this game.' });
      setPlayer(me);
      return;
    }

    setPlayer(me);

    const marksRes = await fetchTileMarks([me.id]);
    if (marksRes.ok) {
      setMarked(marksToSet(marksRes.marks, me.id));
    }
  }, [gameId, userId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const unsubscribe = subscribeToGame(gameId, {
      onGame: (nextGame) => {
        setGame(nextGame);
        if (nextGame.status === 'live') loadAll();
      },
      onPlayer: () => loadAll(),
      onMark: (payload) => {
        if (!player) return;
        if (payload.new?.game_player_id !== player.id && payload.old?.game_player_id !== player.id) {
          return;
        }

        if (payload.eventType === 'DELETE') {
          setMarked((prev) => {
            const next = new Set(prev);
            next.delete(`${payload.old.row}-${payload.old.col}`);
            return next;
          });
        } else if (payload.new?.marked) {
          setMarked((prev) => new Set(prev).add(`${payload.new.row}-${payload.new.col}`));
        }
      },
    });

    return unsubscribe;
  }, [gameId, loadAll, player]);

  const handleToggleMark = async (key) => {
    if (game?.status !== 'live' || !player || player.status !== 'playing') return;

    const [row, col] = key.split('-').map(Number);
    const result = await toggleTileMark(gameId, row, col);

    if (!result.ok) {
      setMsg({ type: 'error', text: result.error });
      return;
    }

    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!game) {
    return <div className="loading-screen">Loading game…</div>;
  }

  if (player?.status === 'kicked') {
    return (
      <div className="app-shell">
        <section className="share-panel stone-panel">
          <p className="form-message error">You were removed from this game.</p>
          <Link to="/" className="btn btn-ghost">
            Back home
          </Link>
        </section>
      </div>
    );
  }

  const isPending = player?.status === 'pending';
  const isWaiting = game.status === 'lobby' && player?.status === 'approved';
  const isLive = game.status === 'live' && player?.status === 'playing';

  return (
    <div className="app-shell">
      <header className="app-header stone-panel">
        <div className="header-brand">
          <span className="skull-icon" aria-hidden="true">
            ☠
          </span>
          <div>
            <h1>{game.name}</h1>
            <p className="header-tagline">
              {username} · {isLive ? 'Live' : isPending ? 'Awaiting approval' : 'Lobby'}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <Link to="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </header>

      {msg.text && <p className={`form-message ${msg.type} banner-message`}>{msg.text}</p>}

      {(isPending || isWaiting) && (
        <section className="waiting-panel stone-panel">
          <h2>
            {isPending ? 'Waiting for host approval…' : 'Waiting for host to start the match…'}
          </h2>
          <p className="hint">Your board will appear when the match goes live.</p>
        </section>
      )}

      {isLive && player && (
        <main className="app-main">
          <section className="board-panel stone-panel board-panel-hero">
            <div className="board-header">
              <div className="board-title-block">
                <h2>Your Board</h2>
                <p className="hint board-hint">Board locked · click tiles to mark</p>
              </div>
              <span className="wildy-badge small">
                {game.board_size}×{game.board_size}
              </span>
            </div>
            <BingoBoard
              grid={player.board_grid}
              size={game.board_size}
              readOnly
              locked
              marked={marked}
              onToggleMark={handleToggleMark}
            />
          </section>
        </main>
      )}
    </div>
  );
}
