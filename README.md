# 3on3 Logging

A fast, minimal **3-on-3 basketball game logging app** for iPads. Built
offline-first with Expo + React Native + TypeScript, backed by Supabase/Postgres
in the cloud and SQLite on-device.

The design principle is **show only what the current step needs**. Logging an
action is a short guided flow: choose an action → choose a player → choose any
required detail → save → back to the action grid.

---

## Monorepo layout

```
.
├── apps/
│   └── mobile/            # Expo React Native app (Expo Router)
│       ├── app/           # File-based routes/screens
│       │   ├── _layout.tsx
│       │   ├── index.tsx              # Home / game list
│       │   ├── create-game.tsx        # Create game
│       │   └── game/[id]/
│       │       ├── roster.tsx         # Roster setup
│       │       ├── log.tsx            # Main logging screen
│       │       └── summary.tsx        # Box score / timeline / export
│       └── src/
│           ├── components/  # BigButton, PlayerGrid, StepRenderer, ScoreBar…
│           ├── db/          # SQLite layer (schema, repos, mappers)
│           ├── flow/        # Action flow engine + action definitions
│           ├── store/       # Zustand store (game data + flow controller)
│           ├── sync/        # Sync service (push/pull, idempotent)
│           ├── supabase/    # Supabase client
│           └── lib/         # uuid, device id helpers
├── packages/
│   └── shared/            # Types, enums, Zod schemas, pure stat functions + tests
├── supabase/
│   ├── migrations/        # 0001_init.sql, 0002_rls.sql
│   ├── seed.sql           # 2 teams, 6 players
│   └── config.toml
├── .env.example
└── package.json           # npm workspaces root
```

### Core concept: the event log is the source of truth

Every action is appended to a per-game sequential log (`game_events`) with a
`sequence_number` and a globally-unique `client_event_id`. **Totals are always
derived** from the log by pure functions in `packages/shared/src/stats.ts` —
they are never stored. Undo is implemented as an appended `undo` event that
references the event it reverses, so the log stays append-only and sync stays
simple.

---

## Local development setup

Requirements: Node 18+, npm 9+, the Expo Go app or an EAS dev build, and
(optionally) the Supabase CLI + Docker for a local backend.

```bash
# 1. Install all workspace dependencies from the repo root
npm install

# 2. Run the shared-logic test suite (no native deps required)
npm run test:shared

# 3. Start the Expo app
npm run mobile           # or: cd apps/mobile && npm start
```

Press `i` to open an iOS simulator, or scan the QR code with an iPad running
Expo Go / a dev build. The app **works fully offline** — Supabase is optional.

---

## Environment variables

The app reads two **public** Expo env vars (safe to ship when RLS is enabled):

| Variable                        | Description                         |
| ------------------------------- | ----------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Your Supabase project URL           |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key       |

```bash
cp .env.example apps/mobile/.env
# then edit apps/mobile/.env with real values
```

If these are missing, the app still runs and stores everything locally; sync
becomes a no-op and the badge shows **Offline only**.

---

## Supabase setup

### Option A — Hosted Supabase

1. Create a project at <https://supabase.com>.
2. In the SQL editor, run the migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
3. (Optional) Run `supabase/seed.sql` to insert two teams and six players.
4. Copy the project **URL** and **anon key** from Project Settings → API into
   `apps/mobile/.env`.

### Option B — Local Supabase (CLI + Docker)

```bash
npm i -g supabase            # or use npx supabase
supabase start               # boots local Postgres + Studio
supabase db reset            # applies migrations/ then seed.sql
```

`supabase db reset` runs every file in `supabase/migrations/` and then
`supabase/seed.sql`. Use the local API URL + anon key printed by `supabase start`.

> **RLS note:** `0002_rls.sql` enables RLS and grants full access to
> *authenticated* users (simple MVP posture). For a no-auth offline demo you can
> uncomment the `anon` policies block in that file. Tighten to organization-scoped
> policies before production.

---

## Building for iPad internal distribution (EAS)

This produces an ad-hoc / internal build installable on registered iPads.

```bash
npm i -g eas-cli
eas login

# One-time: create/link the EAS project and set the projectId in app.json > extra.eas
eas init

# Register the iPads that may install the build (ad hoc provisioning)
eas device:create

# Build an internal-distribution iOS app
cd apps/mobile
eas build --profile preview --platform ios
```

When the build finishes, EAS gives you an install URL / QR code. Open it on a
**registered** iPad to install. The `preview` and `production` profiles in
`eas.json` both use `"distribution": "internal"`.

> Set your real Apple bundle identifier in `apps/mobile/app.json`
> (`ios.bundleIdentifier`) and your EAS `projectId` in `extra.eas.projectId`
> before building.

---

## How to reset the local SQLite database

The app exposes `resetLocalDatabase()` in `apps/mobile/src/db/database.ts`,
which drops and recreates all local tables. Quick ways to trigger a reset:

- **Reinstall the app** (deletes the sandboxed SQLite file), or
- Call `resetLocalDatabase()` from a temporary dev button, or
- In a dev build, clear app data from iOS Settings.

```ts
import { resetLocalDatabase } from '@/db/database';
await resetLocalDatabase();
```

---

## How to seed Supabase

- Hosted: paste `supabase/seed.sql` into the SQL editor and run it.
- Local CLI: `supabase db reset` (runs migrations + seed automatically).

The seed uses fixed UUIDs so you can reference the demo teams/players
deterministically during development.

---

## Testing

```bash
npm run test:shared      # pure stat/reducer/undo/sequence tests (fast)
npm test                 # shared + mobile (mobile uses jest-expo)
```

Covered: score / assist / rebound calculation, undo logic, sequence-number
generation, duplicate `client_event_id` handling, team aggregation, and the
action-flow `buildEvents` (Score/Turnover/Foul/Free-throw).

---

## Action flow engine

Actions are declarative (`apps/mobile/src/flow/actionDefinitions.ts`). Each one
is an `ActionDefinition` with `steps` and a pure `buildEvents(context)`. The UI
(`StepRenderer`) renders the current step generically — there are **no one-off
flow screens**. To change the Score flow, edit its definition; nothing else
needs to change.

```ts
// Score: player → point value → assist (optional) → made_shot event
{
  actionType: ActionType.MADE_SHOT,
  label: 'Score',
  steps: [player, pointValue, assistOptional],
  buildEvents: (ctx) => [/* made_shot with related_player_id = assist */],
}
```

---

## Known limitations

- **Single-device logging.** Sequence numbers are assigned as `max+1` locally,
  which assumes one iPad logs a given game at a time. Concurrent multi-device
  logging can collide (the DB `unique(game_id, sequence_number)` constraint
  protects integrity, but conflicts aren’t auto-resolved). See the TODOs in
  `eventsRepo.ts` and `syncService.ts`.
- **Auth is minimal.** RLS allows any authenticated user; there’s no org/team
  membership enforcement yet.
- **Sync is push-centric.** `pullGamesFromCloud()` hydrates games but does not
  yet pull remote *events* into the local log (scaffolded; see TODO).
- **No realtime.** Sync is manual ("Sync Now") or on app focus.
- **Export is JSON via the share sheet** (no CSV/PDF yet).

---

## Future roadmap

- Multi-device conflict resolution (server-assigned sequence or per-device lanes).
- Pull remote events + Supabase Realtime subscriptions for live multi-device games.
- Organization/team auth scoping in RLS.
- Lineup / on-court tracking and plus-minus.
- Shot-chart metadata (court coordinates already fit in `metadata` jsonb).
- CSV/PDF box-score export and shareable game links.
- Substitution-aware "currently on court" UI.

---

## License

MIT (for the MVP scaffold). Replace as appropriate.
