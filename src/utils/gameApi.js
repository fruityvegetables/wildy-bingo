import { getAppConfig, isDemoMode } from '../lib/config.js';
import { functionsUrl, getSupabase } from '../lib/supabase.js';
import * as demoApi from '../demo/mockGameApi.js';

function notConfigured() {
  return { ok: false, error: 'App is not configured. Check your .env file.' };
}

function formatDbError(error) {
  const message = error?.message || 'Request failed.';
  if (/infinite recursion|policy for relation/i.test(message)) {
    return `${message} Run supabase/migrations/003_fix_rls_recursion.sql in the Supabase SQL editor.`;
  }
  return message;
}

async function callFunction(name, body = {}, requireAuth = true) {
  if (!getAppConfig().isConfigured) return notConfigured();

  const supabase = getSupabase();
  const headers = {
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  if (requireAuth) {
    if (!supabase) return notConfigured();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: 'Not authenticated.' };
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(functionsUrl(name), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error || 'Request failed.' };
  }

  return { ok: true, ...data };
}

export const edgeFunctions = isDemoMode()
  ? demoApi.edgeFunctions
  : {
      signUp: (username, password, turnstileToken) =>
        callFunction('auth-signup', { username, password, turnstileToken }, false),

      logIn: (username, password, turnstileToken) =>
        callFunction('auth-login', { username, password, turnstileToken }, false),

      createGame: (payload) => callFunction('create-game', payload),

      joinGame: (joinCode, turnstileToken) =>
        callFunction('join-game', { joinCode, turnstileToken }),
    };

export async function updateHostBoard(gameId, payload) {
  if (isDemoMode()) return demoApi.updateHostBoard(gameId, payload);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase.rpc('update_host_board', {
    p_game_id: gameId,
    p_name: payload.name,
    p_board_size: payload.boardSize,
    p_host_grid: payload.hostGrid,
    p_item_text: payload.itemText ?? '',
    p_require_approval: payload.requireApproval ?? false,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, game: data };
}

export async function startGame(gameId) {
  if (isDemoMode()) return demoApi.startGame(gameId);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase.rpc('start_game', { p_game_id: gameId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, game: data };
}

export async function approvePlayer(playerId) {
  if (isDemoMode()) return demoApi.approvePlayer(playerId);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase.rpc('approve_player', { p_player_id: playerId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, player: data };
}

export async function kickPlayer(playerId) {
  if (isDemoMode()) return demoApi.kickPlayer(playerId);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase.rpc('kick_player', { p_player_id: playerId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, player: data };
}

export async function toggleTileMark(gameId, row, col) {
  if (isDemoMode()) return demoApi.toggleTileMark(gameId, row, col);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase.rpc('toggle_tile_mark', {
    p_game_id: gameId,
    p_row: row,
    p_col: col,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, mark: data };
}

export async function reportBingoWin(gameId) {
  if (isDemoMode()) return demoApi.reportBingoWin(gameId);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase.rpc('report_bingo_win', { p_game_id: gameId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, ...data };
}

export async function endMatch(gameId) {
  if (isDemoMode()) return demoApi.endMatch(gameId);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase.rpc('end_match', { p_game_id: gameId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, game: data };
}

export async function fetchGame(gameId) {
  if (isDemoMode()) return demoApi.fetchGame(gameId);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase.from('games').select('*').eq('id', gameId).single();
  if (error) return { ok: false, error: formatDbError(error) };
  return { ok: true, game: data };
}

export async function fetchGamePlayers(gameId) {
  if (isDemoMode()) return demoApi.fetchGamePlayers(gameId);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase
    .from('game_players')
    .select('*')
    .eq('game_id', gameId)
    .order('joined_at');

  if (error) return { ok: false, error: formatDbError(error) };
  return { ok: true, players: data };
}

export async function fetchTileMarks(playerIds) {
  if (!playerIds.length) return { ok: true, marks: [] };
  if (isDemoMode()) return demoApi.fetchTileMarks(playerIds);

  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase
    .from('tile_marks')
    .select('*')
    .in('game_player_id', playerIds);

  if (error) return { ok: false, error: formatDbError(error) };
  return { ok: true, marks: data };
}

export function marksToSet(marks, playerId) {
  const set = new Set();
  for (const mark of marks) {
    if (mark.game_player_id === playerId && mark.marked) {
      set.add(`${mark.row}-${mark.col}`);
    }
  }
  return set;
}

export function subscribeToGame(gameId, handlers) {
  if (isDemoMode()) return demoApi.subscribeToGame(gameId, handlers);
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
      (payload) => handlers.onGame?.(payload.new)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
      (payload) => handlers.onPlayer?.(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tile_marks' },
      (payload) => handlers.onMark?.(payload)
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${gameId}` },
      (payload) => handlers.onEvent?.(payload.new)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
