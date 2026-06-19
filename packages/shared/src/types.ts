import type {
  ActionType,
  EventResult,
  FoulType,
  GameStatus,
  ScoringMode,
} from './enums';

/**
 * Domain types. These mirror the cloud (Postgres) schema but use camelCase and
 * are the shapes the app code works with. Mapping to/from snake_case DB rows
 * happens in the data layer.
 */

export interface Team {
  id: string;
  organizationId: string | null;
  name: string;
  createdAt: string;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  jerseyNumber: string | null;
  createdAt: string;
}

export interface Game {
  id: string;
  organizationId: string | null;
  name: string;
  location: string | null;
  gameDate: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  scoringMode: ScoringMode;
  status: GameStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GamePlayer {
  id: string;
  gameId: string;
  playerId: string;
  teamId: string;
  /** Denormalized for offline display convenience. */
  name: string;
  jerseyNumber: string | null;
  active: boolean;
  createdAt: string;
}

/**
 * A single immutable entry in a game's sequential event log.
 *
 * The combination (gameId, sequenceNumber) is unique and defines ordering.
 * clientEventId is a globally-unique UUID generated on-device and is used for
 * idempotent sync (the server upserts on clientEventId).
 */
export interface GameEvent {
  id: string;
  gameId: string;
  sequenceNumber: number;
  clientEventId: string;
  deviceId: string;
  teamId: string | null;
  playerId: string | null;
  /** Secondary player: assister, the player who forced a turnover, blocked shooter, etc. */
  relatedPlayerId: string | null;
  actionType: ActionType;
  pointValue: number | null;
  result: EventResult | string | null;
  metadata: EventMetadata;
  createdBy: string | null;
  localCreatedAt: string;
  serverCreatedAt: string | null;
  syncedAt: string | null;
  deletedAt: string | null;
  /** If this event is an UNDO, points at the event it reverses. */
  undoOfEventId: string | null;
}

/** Free-form per-event metadata (stored as jsonb / TEXT json locally). */
export interface EventMetadata {
  foulType?: FoulType;
  /** Sub: player going out. */
  playerOutId?: string;
  /** Sub: player coming in. */
  playerInId?: string;
  [key: string]: unknown;
}

/** A logical event the UI wants to persist (pre-sequence-number assignment). */
export type NewGameEvent = Omit<
  GameEvent,
  | 'id'
  | 'sequenceNumber'
  | 'serverCreatedAt'
  | 'syncedAt'
  | 'deletedAt'
  | 'localCreatedAt'
> & {
  localCreatedAt?: string;
};

/** Per-player box score line, fully derived from the event log. */
export interface PlayerStatLine {
  playerId: string;
  points: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalPercentage: number; // 0..1, 0 when no attempts
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  assists: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  rebounds: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
}

export interface TeamStatLine extends PlayerStatLine {
  teamId: string;
}
