# Wilderness Bingo

Multiplayer Old School RuneScape wilderness–themed bingo.

- **Frontend:** Cloudflare Pages (static Vite build)
- **Backend / auth / data:** Supabase (Postgres, Auth, Realtime, Edge Functions)
- **Protection:** Cloudflare Turnstile captcha + rate limits

## Game flow

1. **Host creates game** → private 6-character join code
2. **Players join** with code + captcha (optional host approval)
3. **Host starts match** → all boards lock permanently
4. **Realtime tile marking only** during the match
5. **Host monitors** every player board live

## Anti-griefing

- Private join codes
- Turnstile on signup, login, create game, and join
- Rate limits on auth and join (Edge Functions)
- Host kick button
- Optional join approval
- Board locking when the match starts

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_initial.sql` (SQL editor or CLI)
3. Deploy Edge Functions:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy auth-signup
npx supabase functions deploy auth-login
npx supabase functions deploy create-game
npx supabase functions deploy join-game
```

4. Set Edge Function secrets:

```bash
npx supabase secrets set TURNSTILE_SECRET_KEY=your_secret
```

(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are available automatically in Edge Functions.)

5. Enable **Realtime** for `games`, `game_players`, and `tile_marks` (included in migration).

### 2. Cloudflare Turnstile

Create a widget at [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile). Use the **site key** in the frontend and **secret key** in Supabase secrets.

### 3. Frontend env

Copy `.env.example` to `.env` (or run `npm run setup`):

```bash
npm run setup
```

Then edit `.env`:

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_TURNSTILE_SITE_KEY=0x...
```

**Important:** Restart `npm run dev` after creating or editing `.env`. Vite only reads env vars at startup.

### 4. Local dev

```bash
npm install
npm run setup   # creates .env if missing
# edit .env with your keys
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). If port 5173 is busy, Vite picks the next free port — check the terminal output.

### Preview all pages (no Supabase)

Run the demo test server with mock data and a page gallery:

```bash
npm run dev:demo
```

Open **http://localhost:5173/dev** for links to every screen (login, home, host lobby/live, player states, config missing, etc.). No backend setup required.

### 5. Cloudflare Pages

- **Build command:** `npm run build`
- **Output directory:** `dist`
- Add the same `VITE_*` environment variables in Pages settings
- SPA routing: `public/_redirects` is included (`/* /index.html 200`)

## Auth

- **Username + password** (3–20 chars, letters/numbers/underscore)
- Usernames map to internal auth emails (`username@wilderness-bingo.app`)
- Captcha required on signup and login

## Architecture

```
Cloudflare Pages (React)
        │
        ├── Supabase Auth (sessions)
        ├── Supabase Realtime (games, players, marks)
        ├── Postgres RPC (start, kick, approve, toggle mark)
        └── Edge Functions (Turnstile + rate limits for signup/login/create/join)
```

## Notes

- Hosts configure the board in the lobby; boards lock when **Start Match** is pressed.
- Only approved players become active when approval is enabled.
- This is a casual app — no email verification.
