/**
 * Canonical enums and constants shared across the mobile app and (conceptually)
 * the backend. Keep these in sync with the SQL CHECK constraints in
 * /supabase/migrations.
 */

/**
 * The kind of event recorded in the sequential game event log.
 *
 * IMPORTANT: The event log is the source of truth. Totals (box scores, team
 * scores, etc.) are always *derived* from these events, never stored directly.
 */
export const ActionType = {
  MADE_SHOT: 'made_shot',
  MISSED_SHOT: 'missed_shot',
  REBOUND: 'rebound',
  ASSIST: 'assist',
  STEAL: 'steal',
  BLOCK: 'block',
  TURNOVER: 'turnover',
  FOUL: 'foul',
  FREE_THROW: 'free_throw',
  SUBSTITUTION: 'substitution',
  TIMEOUT: 'timeout',
  UNDO: 'undo',
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export const ALL_ACTION_TYPES: ActionType[] = Object.values(ActionType);

/** Scoring rule sets. Drives which point values are offered in the UI. */
export const ScoringMode = {
  /** Standard basketball: 2s / 3s / free throws (1). */
  STANDARD: 'standard',
  /** FIBA 3x3: 1s (inside arc) / 2s (behind arc) / free throws (1). */
  THREE_X_THREE: 'three_x_three',
} as const;

export type ScoringMode = (typeof ScoringMode)[keyof typeof ScoringMode];

/** Point values available for made/missed field goals per scoring mode. */
export const FIELD_GOAL_VALUES: Record<ScoringMode, number[]> = {
  [ScoringMode.STANDARD]: [2, 3],
  [ScoringMode.THREE_X_THREE]: [1, 2],
};

/** Lifecycle of a game. */
export const GameStatus = {
  SETUP: 'setup',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

/** Result discriminator stored on the `result` column for certain events. */
export const EventResult = {
  MADE: 'made',
  MISSED: 'missed',
  OFFENSIVE: 'offensive',
  DEFENSIVE: 'defensive',
} as const;

export type EventResult = (typeof EventResult)[keyof typeof EventResult];

/** Foul classifications (stored in metadata.foulType). */
export const FoulType = {
  PERSONAL: 'personal',
  SHOOTING: 'shooting',
  OFFENSIVE: 'offensive',
  TECHNICAL: 'technical',
} as const;

export type FoulType = (typeof FoulType)[keyof typeof FoulType];

/** Sync state for a locally-created event. */
export const SyncStatus = {
  PENDING: 'pending',
  SYNCED: 'synced',
  ERROR: 'error',
} as const;

export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];
