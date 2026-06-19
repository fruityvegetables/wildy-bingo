import { demoGames, demoMarks, demoPlayersByGame } from './fixtures.js';
import { shuffleBoard } from '../utils/bingo.js';

const ok = (data) => ({ ok: true, ...data });
const fail = (error) => ({ ok: false, error });

const demoEvents = [];

export async function fetchGame(gameId) {
  const game = demoGames[gameId];
  if (!game) return fail('Demo game not found.');
  return ok({ game: { ...game } });
}

export async function fetchGamePlayers(gameId) {
  const players = demoPlayersByGame[gameId] ?? [];
  return ok({ players: players.map((p) => ({ ...p, board_grid: p.board_grid.map((r) => [...r]) })) });
}

export async function fetchTileMarks(playerIds) {
  const marks = demoMarks.filter((m) => playerIds.includes(m.game_player_id));
  return ok({ marks: [...marks] });
}

export async function updateHostBoard(gameId, payload) {
  const game = demoGames[gameId];
  if (!game) return fail('Demo game not found.');
  Object.assign(game, {
    name: payload.name,
    board_size: payload.boardSize,
    host_grid: payload.hostGrid,
    item_text: payload.itemText ?? '',
    require_approval: payload.requireApproval ?? false,
  });
  return ok({ game: { ...game } });
}

export async function startGame(gameId) {
  const game = demoGames[gameId];
  if (!game) return fail('Demo game not found.');
  game.status = 'live';
  game.locked_at = new Date().toISOString();
  const players = demoPlayersByGame[gameId] ?? [];
  players.forEach((p) => {
    if (p.status === 'approved' || p.status === 'pending') {
      p.status = 'playing';
      p.board_grid = shuffleBoard(game.host_grid);
    }
  });
  return ok({ game: { ...game } });
}

export async function approvePlayer(playerId) {
  for (const players of Object.values(demoPlayersByGame)) {
    const p = players.find((x) => x.id === playerId);
    if (p) {
      p.status = 'approved';
      return ok({ player: { ...p } });
    }
  }
  return fail('Player not found.');
}

export async function kickPlayer(playerId) {
  for (const players of Object.values(demoPlayersByGame)) {
    const p = players.find((x) => x.id === playerId);
    if (p) {
      p.status = 'kicked';
      return ok({ player: { ...p } });
    }
  }
  return fail('Player not found.');
}

export async function toggleTileMark(gameId, row, col) {
  const players = demoPlayersByGame[gameId] ?? [];
  const player = players.find((p) => p.status === 'playing');
  if (!player) return fail('No active player.');

  const idx = demoMarks.findIndex(
    (m) => m.game_player_id === player.id && m.row === row && m.col === col
  );

  if (idx >= 0) {
    demoMarks.splice(idx, 1);
    return ok({ mark: null });
  }

  const mark = {
    id: `m-${Date.now()}`,
    game_player_id: player.id,
    row,
    col,
    marked: true,
  };
  demoMarks.push(mark);
  return ok({ mark });
}

const lastDemoCelebration = new Map();

export async function reportBingoWin(gameId) {
  const players = demoPlayersByGame[gameId] ?? [];
  const player = players.find((p) => p.status === 'playing');
  if (!player) return fail('No active player.');

  const key = `${gameId}:${player.id}`;
  const now = Date.now();
  if (lastDemoCelebration.get(key) && now - lastDemoCelebration.get(key) < 5000) {
    return ok({ celebration: false, reason: 'rate_limited', display_name: player.display_name });
  }

  lastDemoCelebration.set(key, now);
  if (!player.won_at) player.won_at = new Date().toISOString();

  demoEvents.push({
    id: `ev-${now}`,
    game_id: gameId,
    player_id: player.id,
    event_type: 'bingo_win',
    payload: { display_name: player.display_name },
    created_at: new Date().toISOString(),
  });

  return ok({
    celebration: true,
    display_name: player.display_name,
    won_at: player.won_at,
  });
}

export async function endMatch(gameId) {
  const game = demoGames[gameId];
  if (!game) return fail('Demo game not found.');
  game.status = 'ended';
  demoEvents.push({
    id: `ev-end-${Date.now()}`,
    game_id: gameId,
    event_type: 'match_ended',
    payload: {},
    created_at: new Date().toISOString(),
  });
  return ok({ game: { ...game } });
}

export function subscribeToGame(_gameId, _handlers) {
  return () => {};
}

export const edgeFunctions = {
  signUp: async (username) => ok({ session: null, username }),
  logIn: async (username) => ok({ session: null, username }),
  createGame: async () => ok({ game: demoGames['demo-host-lobby'] }),
  joinGame: async () => ok({ player: demoPlayersByGame['demo-play-lobby'][0] }),
};

export function marksToSet(marks, playerId) {
  const set = new Set();
  for (const mark of marks) {
    if (mark.game_player_id === playerId && mark.marked) {
      set.add(`${mark.row}-${mark.col}`);
    }
  }
  return set;
}
