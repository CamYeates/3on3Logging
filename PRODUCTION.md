# Path to Production

This document is the complete, ordered checklist to take the 3on3 Logging MVP
from "works on my iPad" to a production deployment you can hand to real teams.

Each section lists **what to do**, **why**, and **where in the code** it lives.
Work top to bottom — later phases assume earlier ones are done.

Legend: `[ ]` = todo · 📁 = file/location to edit · ⚠️ = security-sensitive

---

## Phase 0 — Accounts & prerequisites

- [ ] Apple Developer Program membership ($99/yr) — required for device builds.
- [ ] Expo account + `eas-cli` installed (`npm i -g eas-cli`).
- [ ] Supabase account (hosted) or a self-hosted Postgres + Supabase stack.
- [ ] A password manager / secrets vault for keys (1Password, Doppler, etc.).
- [ ] Decide distribution model:
  - **Internal (ad hoc / EAS internal):** up to 100 registered devices, no review.
  - **TestFlight:** larger beta, light review, 90-day builds.
  - **App Store:** public, full review. (Likely not needed for a team tool.)

---

## Phase 1 — Configure the app identity

📁 `apps/mobile/app.json`

- [ ] Set a real `ios.bundleIdentifier` (e.g. `com.yourorg.threeonthree`).
      The placeholder is `com.example.threeonthree`.
- [ ] Set `android.package` if you ever ship Android.
- [ ] Update `name`, `slug`, `version`.
- [ ] Replace `extra.eas.projectId` with the real id from `eas init`.
- [ ] Add real `splash` and `icon` assets (📁 `apps/mobile/assets/`, then
      reference them in `app.json`). Currently there's no custom icon/splash.

📁 `apps/mobile/eas.json`

- [ ] Confirm build profiles. `preview` and `production` use
      `"distribution": "internal"`. Add an `"appStore"` profile if you go public.

```bash
cd apps/mobile
eas init                 # links project, writes projectId
eas device:create        # register each iPad (ad hoc provisioning)
eas build --profile preview --platform ios
```

---

## Phase 2 — Supabase production database

### 2a. Apply schema

- [ ] Create a **production** Supabase project (separate from dev/staging).
- [ ] Run migrations in order via the SQL editor or CLI:
  - 📁 `supabase/migrations/0001_init.sql`
  - 📁 `supabase/migrations/0002_rls.sql`
- [ ] Do **NOT** run `supabase/seed.sql` in production (it's demo data).

```bash
# Link the CLI to the hosted project, then push migrations
supabase link --project-ref <your-ref>
supabase db push
```

### 2b. ⚠️ Harden Row Level Security

📁 `supabase/migrations/0002_rls.sql`

The MVP grants every authenticated user full access. Before production:

- [ ] Introduce an `organization_members(user_id, organization_id, role)` table.
- [ ] Replace the permissive `*_auth_all` policies with org-scoped checks, e.g.:

```sql
-- New migration: 0003_org_scoped_rls.sql
create policy games_org_read on games for select to authenticated
  using (organization_id in (
    select organization_id from organization_members where user_id = auth.uid()
  ));

create policy games_org_write on games for all to authenticated
  using (organization_id in (
    select organization_id from organization_members where user_id = auth.uid()
  ))
  with check (organization_id in (
    select organization_id from organization_members where user_id = auth.uid()
  ));
-- Repeat the pattern for teams, players, game_players, game_events
-- (join game_events -> games to derive organization_id).
```

- [ ] ⚠️ Ensure the anon policies block stays **commented out** in production.
- [ ] Verify with the Supabase "Policy" linter that no table is left fully open.

### 2c. Server-side integrity (recommended)

- [ ] Add a DB trigger that **rejects** edits/deletes to `game_events` so the log
      stays truly append-only server-side (clients only INSERT and append UNDO
      rows). Soft-delete via `deleted_at` only.
- [ ] Add `created_by = auth.uid()` enforcement via a `before insert` trigger so
      events can't be spoofed to another user.

### 2d. Backups & PITR

- [ ] Enable Point-in-Time Recovery (paid tier) or schedule `pg_dump` exports.
- [ ] Document a restore runbook.

---

## Phase 3 — Authentication

Currently the app has **no login** and `created_by` is always null.

📁 `apps/mobile/src/supabase/client.ts` (client is ready; auth UI is not)

- [ ] Choose an auth method (email magic link is simplest for a team tool;
      Sign in with Apple is iPad-friendly and App Store-required if public).
- [ ] Add a sign-in screen (📁 new `apps/mobile/app/sign-in.tsx`) and gate the
      app: redirect to it from 📁 `apps/mobile/app/_layout.tsx` when
      `supabase.auth.getSession()` is null.
- [ ] On sign-in, upsert a row into `users` and set `created_by` on events:
      📁 `apps/mobile/src/flow/actionDefinitions.ts` `baseEvent()` currently sets
      `createdBy: null` — wire it to the signed-in user id.
- [ ] Handle token refresh while offline (the client already persists sessions
      via AsyncStorage; verify expiry behavior on long offline stretches).

---

## Phase 4 — Multi-device conflict resolution

This is the single biggest known limitation. The MVP assumes **one iPad per
game** and assigns `sequence_number = max + 1` locally.

📁 `apps/mobile/src/db/eventsRepo.ts` (`getNextSequenceNumber`)
📁 `apps/mobile/src/sync/syncService.ts` (`pullEventsForGame`)

Pick one strategy and implement it:

- [ ] **Option A — Server-assigned sequence (recommended).**
  - Keep a local monotonic `local_sequence` per device for ordering UI only.
  - On push, call a Postgres RPC that does
    `sequence_number = (select coalesce(max(sequence_number),0)+1 from game_events where game_id=$1)`
    inside a transaction, returning the authoritative number.
  - Store the returned `sequence_number` back on the local row.
- [ ] **Option B — Per-device lanes + deterministic merge.**
  - Order globally by `(local_created_at, device_id)` and renumber on pull.
  - Simpler offline, but renumbering churns the timeline.

Either way:

- [ ] Add a test for two devices inserting concurrently (extend
      📁 `packages/shared/src/__tests__/stats.test.ts`).
- [ ] Decide UNDO semantics across devices (an undo from device B of device A's
      event — already supported by `undo_of_event_id`, but test it).

---

## Phase 5 — Realtime sync (optional but high-value)

- [ ] Subscribe to `game_events` inserts via Supabase Realtime for the active
      game so a scorer's bench tablet updates live.
      📁 new `apps/mobile/src/sync/realtime.ts`; call from 📁 `app/game/[id]/log.tsx`.
- [ ] On a remote insert, upsert into `local_game_events` (reuse the
      insert-if-absent path from `pullEventsForGame`) and call
      `useGameStore.getState().refresh()`.
- [ ] Add automatic background sync: flush the queue on `AppState` → active and
      on network reconnect (add `@react-native-community/netinfo`).

---

## Phase 6 — Secrets & environments

- [ ] Maintain **three** Supabase projects: dev, staging, production.
- [ ] Store env values as **EAS environment variables / secrets**, not in git:

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://prod.supabase.co --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon> --environment production
```

- [ ] ⚠️ The anon key is public-by-design, but the **service_role** key must
      never ship in the app or git. Use it only in server functions/CI.
- [ ] Confirm 📁 `.gitignore` already excludes `.env` (it does).

---

## Phase 7 — CI/CD

- [ ] Add GitHub Actions: lint + typecheck + test on every PR.

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- [ ] Add EAS build automation on tags (`eas build --non-interactive`), using
      EAS secrets for credentials.
- [ ] Gate merges on green CI.

---

## Phase 8 — Quality, observability, support

- [ ] **Error tracking:** add Sentry (`@sentry/react-native`) and wrap the root
      layout; capture sync failures from 📁 `src/sync/syncService.ts`.
- [ ] **Analytics (optional):** log key funnels (game created, event logged).
- [ ] **Crash-safe sync retry:** the `sync_queue` already records `attempts` and
      `last_error`; add exponential backoff and a "stuck items" view.
- [ ] **Dev tools:** wire `resetLocalDatabase()` to a hidden settings screen
      📁 `apps/mobile/src/db/database.ts` (currently callable but no UI).
- [ ] **E2E tests:** add Maestro or Detox flows for create-game → log → summary.
- [ ] **Accessibility:** verify touch targets (≥ `TOUCH_TARGET`=88) and add
      `accessibilityLabel`s to 📁 `src/components/BigButton.tsx`.

---

## Phase 9 — Pre-launch verification

- [ ] Full offline run: airplane mode → log a complete game → reconnect →
      "Sync Now" → confirm rows land in Supabase with correct sequence numbers.
- [ ] Idempotency: trigger sync twice rapidly; confirm no duplicate
      `client_event_id` rows server-side.
- [ ] Undo across a sync boundary: undo an already-synced event; confirm the
      UNDO event syncs and totals recompute.
- [ ] Box-score spot check against a hand-scored game.
- [ ] Install the EAS build on a clean, registered iPad and repeat the above.
- [ ] Confirm landscape lock and large-target ergonomics on a real device.

---

## Phase 10 — Launch & operate

- [ ] Distribute the `preview`/`production` EAS build link to registered iPads
      (or push to TestFlight).
- [ ] Publish OTA JS updates with `eas update` for non-native fixes:
      `eas update --branch production --message "fix box score"`.
- [ ] Keep a CHANGELOG and bump `app.json` `version` per release.
- [ ] Monitor Sentry + Supabase logs for the first live games.
- [ ] Write a one-page user guide for scorers (the flow is self-explanatory, but
      cover Undo and Sync Now).

---

## Quick "definition of done" for production

A build is production-ready when **all** are true:

1. Real bundle id, icon, splash, and EAS projectId are set.
2. Production Supabase has org-scoped RLS, append-only event protection, and backups.
3. Users sign in; `created_by` is populated and trustworthy.
4. Multi-device sequence assignment is server-authoritative (or single-device is
   an explicitly documented and enforced constraint).
5. CI runs lint + typecheck + tests on every PR and is green.
6. Sentry is capturing errors; sync failures are visible and retried.
7. The full offline → reconnect → sync loop has been verified on a real iPad.
