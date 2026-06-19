/**
 * Local SQLite schema (offline-first mirror of the cloud tables).
 *
 * Tables:
 *  - local_games
 *  - local_players
 *  - local_game_players
 *  - local_game_events   (the sequential event log; source of truth on device)
 *  - sync_queue          (pending pushes; idempotent via client_event_id)
 *  - app_settings        (device_id, last sync time, etc.)
 *
 * All `*_json` columns hold serialized JSON. Booleans are stored as 0/1.
 */
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS local_games (
  id              TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT,
  name            TEXT NOT NULL,
  location        TEXT,
  game_date       TEXT NOT NULL,
  team_a_id       TEXT NOT NULL,
  team_b_id       TEXT NOT NULL,
  team_a_name     TEXT NOT NULL,
  team_b_name     TEXT NOT NULL,
  scoring_mode    TEXT NOT NULL DEFAULT 'standard',
  status          TEXT NOT NULL DEFAULT 'setup',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  synced_at       TEXT
);

CREATE TABLE IF NOT EXISTS local_players (
  id            TEXT PRIMARY KEY NOT NULL,
  team_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  jersey_number TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_game_players (
  id            TEXT PRIMARY KEY NOT NULL,
  game_id       TEXT NOT NULL,
  player_id     TEXT NOT NULL,
  team_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  jersey_number TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  UNIQUE (game_id, player_id)
);

CREATE TABLE IF NOT EXISTS local_game_events (
  id                TEXT PRIMARY KEY NOT NULL,
  game_id           TEXT NOT NULL,
  sequence_number   INTEGER NOT NULL,
  client_event_id   TEXT NOT NULL UNIQUE,
  device_id         TEXT NOT NULL,
  team_id           TEXT,
  player_id         TEXT,
  related_player_id TEXT,
  action_type       TEXT NOT NULL,
  point_value       INTEGER,
  result            TEXT,
  metadata_json     TEXT NOT NULL DEFAULT '{}',
  created_by        TEXT,
  local_created_at  TEXT NOT NULL,
  server_created_at TEXT,
  synced_at         TEXT,
  deleted_at        TEXT,
  undo_of_event_id  TEXT,
  UNIQUE (game_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_local_events_game ON local_game_events(game_id);
CREATE INDEX IF NOT EXISTS idx_local_events_player ON local_game_events(player_id);
CREATE INDEX IF NOT EXISTS idx_local_events_action ON local_game_events(action_type);
CREATE INDEX IF NOT EXISTS idx_local_events_seq ON local_game_events(game_id, sequence_number);

CREATE TABLE IF NOT EXISTS sync_queue (
  id              TEXT PRIMARY KEY NOT NULL,
  entity_type     TEXT NOT NULL,           -- 'game' | 'game_player' | 'event'
  entity_id       TEXT NOT NULL,
  client_event_id TEXT,                     -- for events; used for idempotent upsert
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'synced' | 'error'
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT
);
`;
