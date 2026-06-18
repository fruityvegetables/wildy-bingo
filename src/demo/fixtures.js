import { fillGridFromLines, initGrid, parseItemLines } from '../utils/bingo.js';

export const DEMO_HOST_ID = 'demo-host-1';
export const DEMO_PLAYER_IDS = {
  pending: 'demo-player-pending',
  approved: 'demo-player-approved',
  playing: 'demo-player-playing',
  kicked: 'demo-player-kicked',
};

const wildyLines = [
  'PKed at Edgeville',
  'Got 3-itemed',
  'Seen a bot',
  'Claw spec',
  'Tele blocked',
  'Lured to multi',
  'DDOS joke',
  'Ragged in deep',
  'Lost ags',
  'Fake switch',
  'Skulled by accident',
  'Ent tragged',
  'Chins dumped',
  'Venenatis peek',
  'Call came in',
  'Bank was full',
  'Pure rushed me',
  'PJed a fight',
  'Maced at lava',
  'Rev cave dip',
  'Black chins',
  'TB landed',
  'Smite prayer',
  'Red portal hop',
];

const demoGrid = fillGridFromLines(initGrid(5), wildyLines);

const baseGame = {
  name: 'Wildy PK Night (Demo)',
  board_size: 5,
  host_grid: demoGrid,
  item_text: wildyLines.join('\n'),
  require_approval: true,
  join_code: 'DEMO42',
};

export const demoGames = {
  'demo-host-lobby': {
    ...baseGame,
    id: 'demo-host-lobby',
    host_id: DEMO_HOST_ID,
    status: 'lobby',
    locked_at: null,
  },
  'demo-host-live': {
    ...baseGame,
    id: 'demo-host-live',
    host_id: DEMO_HOST_ID,
    status: 'live',
    locked_at: new Date().toISOString(),
  },
  'demo-play-pending': {
    ...baseGame,
    id: 'demo-play-pending',
    host_id: DEMO_HOST_ID,
    status: 'lobby',
    locked_at: null,
  },
  'demo-play-lobby': {
    ...baseGame,
    id: 'demo-play-lobby',
    host_id: DEMO_HOST_ID,
    status: 'lobby',
    locked_at: null,
    require_approval: false,
  },
  'demo-play-live': {
    ...baseGame,
    id: 'demo-play-live',
    host_id: DEMO_HOST_ID,
    status: 'live',
    locked_at: new Date().toISOString(),
    require_approval: false,
  },
  'demo-play-kicked': {
    ...baseGame,
    id: 'demo-play-kicked',
    host_id: DEMO_HOST_ID,
    status: 'lobby',
    locked_at: null,
  },
};

function player(id, gameId, userId, displayName, status) {
  return {
    id,
    game_id: gameId,
    user_id: userId,
    display_name: displayName,
    status,
    board_grid: demoGrid,
    joined_at: new Date().toISOString(),
  };
}

export const demoPlayersByGame = {
  'demo-host-lobby': [
    player('gp-1', 'demo-host-lobby', DEMO_PLAYER_IDS.approved, 'pk_snake', 'approved'),
    player('gp-2', 'demo-host-lobby', DEMO_PLAYER_IDS.pending, 'edge_lad', 'pending'),
  ],
  'demo-host-live': [
    player('gp-3', 'demo-host-live', DEMO_PLAYER_IDS.playing, 'pk_snake', 'playing'),
    player('gp-4', 'demo-host-live', 'demo-player-2', 'wildy_main', 'playing'),
  ],
  'demo-play-pending': [
    player('gp-5', 'demo-play-pending', DEMO_PLAYER_IDS.pending, 'edge_lad', 'pending'),
  ],
  'demo-play-lobby': [
    player('gp-6', 'demo-play-lobby', DEMO_PLAYER_IDS.approved, 'pk_snake', 'approved'),
  ],
  'demo-play-live': [
    player('gp-7', 'demo-play-live', DEMO_PLAYER_IDS.playing, 'pk_snake', 'playing'),
  ],
  'demo-play-kicked': [
    player('gp-8', 'demo-play-kicked', DEMO_PLAYER_IDS.kicked, 'grief_kid', 'kicked'),
  ],
};

export const demoMarks = [
  { id: 'm-1', game_player_id: 'gp-3', row: 0, col: 0, marked: true },
  { id: 'm-2', game_player_id: 'gp-3', row: 1, col: 2, marked: true },
  { id: 'm-3', game_player_id: 'gp-4', row: 2, col: 1, marked: true },
  { id: 'm-4', game_player_id: 'gp-7', row: 0, col: 1, marked: true },
  { id: 'm-5', game_player_id: 'gp-7', row: 3, col: 4, marked: true },
];

export const demoPages = [
  { path: '/dev/pages/config', label: 'Config missing', description: 'Setup screen when env vars are absent' },
  { path: '/dev/pages/login', label: 'Login / Sign up', description: 'Auth form (logged out)' },
  { path: '/dev/pages/home', label: 'Home', description: 'Host or join hub (logged in)' },
  { path: '/dev/pages/host-lobby', label: 'Host · lobby', description: 'Board setup, join code, player list' },
  { path: '/dev/pages/host-live', label: 'Host · live', description: 'Locked board + monitor all players' },
  { path: '/dev/pages/player-pending', label: 'Player · awaiting approval', description: 'Pending join state' },
  { path: '/dev/pages/player-lobby', label: 'Player · waiting to start', description: 'Approved, match not started' },
  { path: '/dev/pages/player-live', label: 'Player · live', description: 'Locked board, mark tiles' },
  { path: '/dev/pages/player-kicked', label: 'Player · kicked', description: 'Removed from game' },
];

export { wildyLines, parseItemLines };
