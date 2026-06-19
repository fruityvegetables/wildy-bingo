import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BingoBoard from './BingoBoard.jsx';
import {
  cellCount,
  fillGridFromLines,
  initGrid,
  parseItemLines,
  resizeGrid,
  shuffleBoard,
  shuffleColumns,
} from '../utils/bingo.js';
import {
  approvePlayer,
  endMatch,
  fetchGame,
  fetchGamePlayers,
  fetchTileMarks,
  kickPlayer,
  marksToSet,
  startGame,
  subscribeToGame,
  toggleTileMark,
  updateHostBoard,
} from '../utils/gameApi.js';
import { useWinCelebration } from '../utils/useWinCelebration.js';
import WinCelebration from './WinCelebration.jsx';

export default function HostGameView({ demoGameId }) {
  const { gameId: routeGameId } = useParams();
  const gameId = demoGameId ?? routeGameId;
  const { username } = useAuth();
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [marks, setMarks] = useState([]);
  const [size, setSize] = useState(5);
  const [grid, setGrid] = useState(() => initGrid(5));
  const [itemText, setItemText] = useState('');
  const [requireApproval, setRequireApproval] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [hostMarks, setHostMarks] = useState(() => new Set());
  const { celebrate, headline, handleGameEvent } = useWinCelebration();

  const isLobby = game?.status === 'lobby';
  const isLive = game?.status === 'live';
  const isEnded = game?.status === 'ended';

  const loadAll = useCallback(async () => {
    const [gameRes, playersRes] = await Promise.all([fetchGame(gameId), fetchGamePlayers(gameId)]);

    if (!gameRes.ok) {
      setMsg({ type: 'error', text: gameRes.error });
      return;
    }

    setGame(gameRes.game);
    setSize(gameRes.game.board_size);
    setGrid(gameRes.game.host_grid);
    setItemText(gameRes.game.item_text || '');
    setRequireApproval(gameRes.game.require_approval);

    if (playersRes.ok) {
      setPlayers(playersRes.players);
      const ids = playersRes.players.map((p) => p.id);
      const marksRes = await fetchTileMarks(ids);
      if (marksRes.ok) setMarks(marksRes.marks);
    }
  }, [gameId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const unsubscribe = subscribeToGame(gameId, {
      onGame: (nextGame) => setGame(nextGame),
      onPlayer: () => loadAll(),
      onEvent: (event) => {
        handleGameEvent(event);
        if (event.event_type === 'match_ended') loadAll();
      },
      onMark: (payload) => {
        if (payload.eventType === 'DELETE') {
          setMarks((prev) =>
            prev.filter(
              (m) =>
                !(
                  m.game_player_id === payload.old.game_player_id &&
                  m.row === payload.old.row &&
                  m.col === payload.old.col
                )
            )
          );
        } else {
          setMarks((prev) => {
            const filtered = prev.filter(
              (m) =>
                !(
                  m.game_player_id === payload.new.game_player_id &&
                  m.row === payload.new.row &&
                  m.col === payload.new.col
                )
            );
            return payload.new.marked ? [...filtered, payload.new] : filtered;
          });
        }
      },
    });

    return unsubscribe;
  }, [gameId, loadAll, handleGameEvent]);

  const saveBoard = async () => {
    if (!isLobby) return;
    setBusy(true);
    const result = await updateHostBoard(gameId, {
      name: game.name,
      boardSize: size,
      hostGrid: grid,
      itemText,
      requireApproval,
    });
    setBusy(false);
    setMsg({
      type: result.ok ? 'success' : 'error',
      text: result.ok ? 'Board saved.' : result.error,
    });
    if (result.ok) setGame(result.game);
  };

  const handleStart = async () => {
    if (!window.confirm('Start the match? Boards will lock permanently.')) return;
    setBusy(true);
    const saveResult = await updateHostBoard(gameId, {
      name: game.name,
      boardSize: size,
      hostGrid: grid,
      itemText,
      requireApproval,
    });
    if (!saveResult.ok) {
      setBusy(false);
      setMsg({ type: 'error', text: saveResult.error });
      return;
    }

    const result = await startGame(gameId);
    setBusy(false);
    if (!result.ok) {
      setMsg({ type: 'error', text: result.error });
      return;
    }
    setGame(result.game);
    setShowSetup(false);
    setMsg({ type: 'success', text: 'Match started — each player gets a unique shuffled board.' });
    loadAll();
  };

  const handleEndMatch = async () => {
    if (!window.confirm('End the match for everyone?')) return;
    setBusy(true);
    const result = await endMatch(gameId);
    setBusy(false);
    if (!result.ok) {
      setMsg({ type: 'error', text: result.error });
      return;
    }
    setGame(result.game);
    setMsg({ type: 'success', text: 'Match ended.' });
    loadAll();
  };

  const handleApprove = async (playerId) => {
    const result = await approvePlayer(playerId);
    setMsg({
      type: result.ok ? 'success' : 'error',
      text: result.ok ? 'Player approved.' : result.error,
    });
    if (result.ok) loadAll();
  };

  const handleKick = async (playerId) => {
    if (!window.confirm('Kick this player?')) return;
    const result = await kickPlayer(playerId);
    setMsg({
      type: result.ok ? 'success' : 'error',
      text: result.ok ? 'Player kicked.' : result.error,
    });
    if (result.ok) loadAll();
  };

  const handleSizeChange = (newSize) => {
    if (!isLobby) return;
    const parsed = Number(newSize);
    setSize(parsed);
    setGrid((prev) => resizeGrid(prev, parsed));
  };

  const approvedPlayers = useMemo(
    () => players.filter((p) => p.status === 'approved'),
    [players]
  );

  const playingPlayers = useMemo(
    () => players.filter((p) => p.status === 'playing'),
    [players]
  );

  if (!game) {
    return <div className="loading-screen">Loading game…</div>;
  }

  return (
    <div className="app-shell">
      <WinCelebration active={celebrate} headline={headline} />
      <header className="app-header stone-panel">
        <div className="header-brand">
          <span className="skull-icon" aria-hidden="true">
            ☠
          </span>
          <div>
            <h1>{game.name}</h1>
            <p className="header-tagline">
              Host · {isLobby ? 'Lobby' : isEnded ? 'Ended' : 'Live'} · code{' '}
              <strong className="join-code">{game.join_code}</strong>
            </p>
          </div>
        </div>
        <div className="header-actions">
          <span className="user-chip">{username}</span>
          {isLobby && (
            <button
              type="button"
              className={`btn btn-ghost ${showSetup ? 'btn-active' : ''}`}
              onClick={() => setShowSetup((v) => !v)}
            >
              Card Setup
            </button>
          )}
          {isLive && (
            <button type="button" className="btn btn-danger" onClick={handleEndMatch} disabled={busy}>
              End Match
            </button>
          )}
          <Link to="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </header>

      {isEnded && (
        <p className="form-message success match-ended-banner">This match has ended.</p>
      )}

      {msg.text && <p className={`form-message ${msg.type} banner-message`}>{msg.text}</p>}

      {isLobby && showSetup && (
        <section className="controls-panel stone-panel">
          <h2>Card Setup</h2>
          <div className="setup-grid">
            <div className="setup-column">
              <label className="control-row">
                Grid size
                <select value={size} onChange={(e) => handleSizeChange(e.target.value)}>
                  {[5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}×{n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bulk items (one per line)
                <textarea
                  className="items-textarea"
                  value={itemText}
                  onChange={(e) => setItemText(e.target.value)}
                  rows={5}
                />
              </label>
              <p className="hint">
                {parseItemLines(itemText).length} lines · {cellCount(size)} tiles
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setGrid((g) => fillGridFromLines(g, parseItemLines(itemText)))}
                >
                  Fill Tiles
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setGrid((g) => shuffleColumns(g))}
                >
                  Shuffle Columns
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setGrid((g) => shuffleBoard(g))}
                >
                  Shuffle Board
                </button>
              </div>
            </div>
            <div className="setup-column">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                />
                Require approval to join
              </label>
              <h3>Players ({players.length})</h3>
              <ul className="saved-list player-list">
                {players.length === 0 && <li className="hint">Waiting for players…</li>}
                {players.map((p) => (
                  <li key={p.id} className="player-row">
                    <span>
                      {p.display_name}{' '}
                      <span className="saved-meta">· {p.status}</span>
                    </span>
                    <span className="player-actions">
                      {p.status === 'pending' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => handleApprove(p.id)}
                        >
                          Approve
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() => handleKick(p.id)}
                      >
                        Kick
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="button-row">
                <button type="button" className="btn btn-primary" onClick={saveBoard} disabled={busy}>
                  Save Board
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleStart}
                  disabled={busy || approvedPlayers.length === 0}
                >
                  Start Match
                </button>
              </div>
              <p className="hint footnote">
                Share join code <strong>{game.join_code}</strong>. On start, each player gets the same
                items in a different layout.
              </p>
            </div>
          </div>
        </section>
      )}

      <main className="app-main">
        <section className="board-panel stone-panel board-panel-hero">
          <div className="board-header">
            <div className="board-title-block">
              <h2>{isLive ? 'Host Board (locked)' : 'Host Board'}</h2>
              <p className="hint board-hint">
                {isLive
                  ? 'Monitoring all player boards below'
                  : 'Set up tiles before starting the match'}
              </p>
            </div>
            <span className="wildy-badge small">{size}×{size}</span>
          </div>
          <BingoBoard
            grid={grid}
            size={size}
            locked={isLive}
            onTileChange={(row, col, value) => {
              if (!isLobby) return;
              setGrid((prev) => {
                const next = prev.map((r) => [...r]);
                next[row][col] = value;
                return next;
              });
            }}
            marked={hostMarks}
            onToggleMark={(key) => {
              if (!isLive) return;
              setHostMarks((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
          />
        </section>

        {(isLive || isEnded) && (
          <section className="monitor-panel stone-panel">
            <h2>{isEnded ? 'Final Boards' : 'Player Boards'}</h2>
            <div className="monitor-grid">
              {playingPlayers.map((player) => (
                <div key={player.id} className="monitor-card">
                  <h3>
                    {player.display_name}
                    {player.won_at && <span className="winner-badge">Bingo</span>}
                  </h3>
                  <BingoBoard
                    grid={player.board_grid}
                    size={game.board_size}
                    readOnly
                    locked
                    marked={marksToSet(marks, player.id)}
                  />
                </div>
              ))}
              {playingPlayers.length === 0 && (
                <p className="hint">No active players yet.</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
