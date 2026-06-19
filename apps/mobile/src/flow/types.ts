import type {
  ActionType,
  GamePlayer,
  NewGameEvent,
  ScoringMode,
} from '@3on3/shared';

/**
 * Action Flow Engine types.
 *
 * Each logging action (Score, Miss, Rebound, …) is described declaratively as
 * an ActionDefinition: an ordered list of steps plus a pure `buildEvents`
 * function. The UI renders the current step generically — there are no
 * one-off screens. Changing the Score flow = editing its definition.
 */

export type StepKind = 'player' | 'option' | 'player-optional';

export interface FlowOption {
  label: string;
  /** Stored into the selection map under the step id. */
  value: string | number;
  /** Optional accent color for the button. */
  color?: string;
}

/** A single decision in a flow. Exactly one decision per screen. */
export interface FlowStep {
  id: string;
  kind: StepKind;
  /** Short prompt shown at the top of the step (minimal text). */
  title: string;
  /** For `option` steps: the choices, computed from context. */
  options?: (ctx: FlowContext) => FlowOption[];
  /** For `player`/`player-optional`: restrict to a team. Defaults to all. */
  teamFilter?: (ctx: FlowContext) => string | null;
  /** For `player-optional`: label of the "skip" button (e.g. "No Assist"). */
  noneLabel?: string;
  /** Optionally skip this step entirely based on prior selections. */
  skipIf?: (ctx: FlowContext) => boolean;
}

/** Mutable accumulator threaded through a flow as the user makes choices. */
export interface FlowContext {
  gameId: string;
  scoringMode: ScoringMode;
  deviceId: string;
  /** Active roster, both teams. */
  players: GamePlayer[];
  /** Selections keyed by step id. Player steps store playerId (or null). */
  selections: Record<string, string | number | null>;
}

export interface ActionDefinition {
  actionType: ActionType;
  /** Button label on the main logging screen. */
  label: string;
  /** Accent color for the main button. */
  color?: string;
  /** Ordered steps. May be empty for one-tap actions (e.g. Timeout). */
  steps: FlowStep[];
  /**
   * Pure: turn the completed selections into one or more events to persist.
   * Returns events WITHOUT id/sequenceNumber (assigned at save time).
   */
  buildEvents: (ctx: FlowContext) => NewGameEvent[];
}

/** Helper used inside buildEvents to read a player selection. */
export function getSelectedPlayerId(
  ctx: FlowContext,
  stepId: string,
): string | null {
  const v = ctx.selections[stepId];
  return typeof v === 'string' ? v : null;
}

/** Helper used inside buildEvents to read the team of a selected player. */
export function getTeamIdForPlayer(
  ctx: FlowContext,
  playerId: string | null,
): string | null {
  if (!playerId) return null;
  return ctx.players.find((p) => p.playerId === playerId)?.teamId ?? null;
}
