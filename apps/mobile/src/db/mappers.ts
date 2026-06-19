import type { Game, GameEvent, GamePlayer, EventMetadata } from '@3on3/shared';

/** Row shapes as stored in SQLite (snake_case, 0/1 booleans, json strings). */
export interface GameRow {
  id: string;
  organization_id: string | null;
  name: string;
  location: string | null;
  game_date: string;
  team_a_id: string;
  team_b_id: string;
  team_a_name: string;
  team_b_name: string;
  scoring_mode: string;
  status: string;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface GamePlayerRow {
  id: string;
  game_id: string;
  player_id: string;
  team_id: string;
  name: string;
  jersey_number: string | null;
  active: number;
  created_at: string;
}

export interface GameEventRow {
  id: string;
  game_id: string;
  sequence_number: number;
  client_event_id: string;
  device_id: string;
  team_id: string | null;
  player_id: string | null;
  related_player_id: string | null;
  action_type: string;
  point_value: number | null;
  result: string | null;
  metadata_json: string;
  created_by: string | null;
  local_created_at: string;
  server_created_at: string | null;
  synced_at: string | null;
  deleted_at: string | null;
  undo_of_event_id: string | null;
}

export function rowToGame(r: GameRow): Game {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    location: r.location,
    gameDate: r.game_date,
    teamAId: r.team_a_id,
    teamBId: r.team_b_id,
    teamAName: r.team_a_name,
    teamBName: r.team_b_name,
    scoringMode: r.scoring_mode as Game['scoringMode'],
    status: r.status as Game['status'],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToGamePlayer(r: GamePlayerRow): GamePlayer {
  return {
    id: r.id,
    gameId: r.game_id,
    playerId: r.player_id,
    teamId: r.team_id,
    name: r.name,
    jerseyNumber: r.jersey_number,
    active: r.active === 1,
    createdAt: r.created_at,
  };
}

export function rowToGameEvent(r: GameEventRow): GameEvent {
  let metadata: EventMetadata = {};
  try {
    metadata = JSON.parse(r.metadata_json) as EventMetadata;
  } catch {
    metadata = {};
  }
  return {
    id: r.id,
    gameId: r.game_id,
    sequenceNumber: r.sequence_number,
    clientEventId: r.client_event_id,
    deviceId: r.device_id,
    teamId: r.team_id,
    playerId: r.player_id,
    relatedPlayerId: r.related_player_id,
    actionType: r.action_type as GameEvent['actionType'],
    pointValue: r.point_value,
    result: r.result,
    metadata,
    createdBy: r.created_by,
    localCreatedAt: r.local_created_at,
    serverCreatedAt: r.server_created_at,
    syncedAt: r.synced_at,
    deletedAt: r.deleted_at,
    undoOfEventId: r.undo_of_event_id,
  };
}
