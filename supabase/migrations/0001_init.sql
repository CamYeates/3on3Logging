-- 3on3 Logging — initial schema
-- The game_events table is an append-only sequential log and the source of
-- truth. All box-score totals are derived from it client-side.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- users (application profile; mirrors auth.users.id when auth is enabled)
-- ---------------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text,
  display_name  text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table if not exists teams (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organizations(id) on delete set null,
  name             text not null,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table if not exists players (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid references teams(id) on delete cascade,
  name           text not null,
  jersey_number  text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_players_team_id on players(team_id);

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
create table if not exists games (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organizations(id) on delete set null,
  name             text not null,
  location         text,
  game_date        timestamptz not null default now(),
  team_a_id        uuid references teams(id),
  team_b_id        uuid references teams(id),
  scoring_mode     text not null default 'standard'
                     check (scoring_mode in ('standard', 'three_x_three')),
  status           text not null default 'setup'
                     check (status in ('setup', 'active', 'completed', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- game_players (roster snapshot for a specific game)
-- ---------------------------------------------------------------------------
create table if not exists game_players (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  team_id     uuid not null references teams(id),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (game_id, player_id)
);
create index if not exists idx_game_players_game_id on game_players(game_id);

-- ---------------------------------------------------------------------------
-- game_events (append-only sequential event log — source of truth)
-- ---------------------------------------------------------------------------
create table if not exists game_events (
  id                 uuid primary key default gen_random_uuid(),
  game_id            uuid not null references games(id) on delete cascade,
  sequence_number    integer not null,
  client_event_id    text not null,
  device_id          text not null,
  team_id            uuid references teams(id),
  player_id          uuid references players(id),
  related_player_id  uuid references players(id),
  action_type        text not null,
  point_value        integer,
  result             text,
  metadata           jsonb not null default '{}'::jsonb,
  created_by         uuid references users(id),
  local_created_at   timestamptz,
  server_created_at  timestamptz not null default now(),
  synced_at          timestamptz,
  deleted_at         timestamptz,
  undo_of_event_id   uuid,
  -- Ordering is unique per game (single-device assumption for MVP).
  constraint uq_game_events_game_seq unique (game_id, sequence_number),
  -- Idempotent sync key.
  constraint uq_game_events_client_event_id unique (client_event_id)
);

create index if not exists idx_game_events_game_id on game_events(game_id);
create index if not exists idx_game_events_player_id on game_events(player_id);
create index if not exists idx_game_events_action_type on game_events(action_type);
create index if not exists idx_game_events_server_created_at on game_events(server_created_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger for games
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_games_updated_at on games;
create trigger trg_games_updated_at
  before update on games
  for each row execute function set_updated_at();
