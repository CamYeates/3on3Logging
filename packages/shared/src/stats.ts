import { ActionType, EventResult } from './enums';
import type { GameEvent, PlayerStatLine, TeamStatLine } from './types';

/**
 * Pure stat-calculation functions.
 *
 * Design rule: totals are NEVER stored as the source of truth. They are always
 * computed from the immutable event log. This keeps the data model simple and
 * makes Undo trivial — undone events are just filtered out before reducing.
 */

function emptyStatLine(playerId: string): PlayerStatLine {
  return {
    playerId,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    fieldGoalPercentage: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    assists: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    rebounds: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
  };
}

/**
 * Returns the set of events that are "live" — i.e. not soft-deleted and not
 * reversed by a subsequent UNDO event. UNDO events themselves are excluded.
 *
 * This is the single chokepoint that implements undo semantics for every
 * downstream calculation.
 */
export function getActiveEvents(events: GameEvent[]): GameEvent[] {
  const undoneEventIds = new Set<string>();
  for (const e of events) {
    if (e.actionType === ActionType.UNDO && e.undoOfEventId) {
      undoneEventIds.add(e.undoOfEventId);
    }
  }

  return events
    .filter(
      (e) =>
        e.actionType !== ActionType.UNDO &&
        e.deletedAt == null &&
        !undoneEventIds.has(e.id),
    )
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

function withPercentage(line: PlayerStatLine): PlayerStatLine {
  line.rebounds = line.offensiveRebounds + line.defensiveRebounds;
  line.fieldGoalPercentage =
    line.fieldGoalsAttempted > 0
      ? line.fieldGoalsMade / line.fieldGoalsAttempted
      : 0;
  return line;
}

/**
 * Reduces the event log into a per-player box score keyed by playerId.
 */
export function calculatePlayerStats(
  events: GameEvent[],
): Record<string, PlayerStatLine> {
  const active = getActiveEvents(events);
  const lines: Record<string, PlayerStatLine> = {};

  const lineFor = (playerId: string | null): PlayerStatLine | null => {
    if (!playerId) return null;
    if (!lines[playerId]) lines[playerId] = emptyStatLine(playerId);
    return lines[playerId];
  };

  for (const e of active) {
    const line = lineFor(e.playerId);

    switch (e.actionType) {
      case ActionType.MADE_SHOT: {
        if (!line) break;
        const pts = e.pointValue ?? 0;
        line.points += pts;
        line.fieldGoalsMade += 1;
        line.fieldGoalsAttempted += 1;
        // An assist may be linked directly on the made shot event.
        const assistLine = lineFor(e.relatedPlayerId);
        if (assistLine) assistLine.assists += 1;
        break;
      }
      case ActionType.MISSED_SHOT: {
        if (!line) break;
        line.fieldGoalsAttempted += 1;
        break;
      }
      case ActionType.ASSIST: {
        // Standalone assist event (when not linked on a made_shot).
        if (line) line.assists += 1;
        break;
      }
      case ActionType.FREE_THROW: {
        if (!line) break;
        line.freeThrowsAttempted += 1;
        if (e.result === EventResult.MADE) {
          line.freeThrowsMade += 1;
          line.points += e.pointValue ?? 1;
        }
        break;
      }
      case ActionType.REBOUND: {
        if (!line) break;
        if (e.result === EventResult.OFFENSIVE) line.offensiveRebounds += 1;
        else line.defensiveRebounds += 1;
        break;
      }
      case ActionType.STEAL: {
        if (line) line.steals += 1;
        break;
      }
      case ActionType.BLOCK: {
        if (line) line.blocks += 1;
        break;
      }
      case ActionType.TURNOVER: {
        if (line) line.turnovers += 1;
        // A forced turnover may link the stealing player directly.
        const stealLine = lineFor(e.relatedPlayerId);
        if (stealLine) stealLine.steals += 1;
        break;
      }
      case ActionType.FOUL: {
        if (line) line.fouls += 1;
        break;
      }
      // SUBSTITUTION / TIMEOUT do not affect the box score.
      default:
        break;
    }
  }

  for (const id of Object.keys(lines)) withPercentage(lines[id]);
  return lines;
}

/**
 * Aggregates per-team totals. Requires a map of playerId -> teamId for the
 * game (from game_players). Events that already carry a teamId are also
 * respected for team-level events (e.g. timeouts) but box-score stats are
 * attributed via the player's team.
 */
export function calculateTeamStats(
  events: GameEvent[],
  playerTeamMap: Record<string, string>,
): Record<string, TeamStatLine> {
  const playerStats = calculatePlayerStats(events);
  const teams: Record<string, TeamStatLine> = {};

  const teamFor = (teamId: string): TeamStatLine => {
    if (!teams[teamId]) {
      teams[teamId] = { ...emptyStatLine(`team:${teamId}`), teamId };
    }
    return teams[teamId];
  };

  for (const [playerId, line] of Object.entries(playerStats)) {
    const teamId = playerTeamMap[playerId];
    if (!teamId) continue;
    const t = teamFor(teamId);
    t.points += line.points;
    t.fieldGoalsMade += line.fieldGoalsMade;
    t.fieldGoalsAttempted += line.fieldGoalsAttempted;
    t.freeThrowsMade += line.freeThrowsMade;
    t.freeThrowsAttempted += line.freeThrowsAttempted;
    t.assists += line.assists;
    t.offensiveRebounds += line.offensiveRebounds;
    t.defensiveRebounds += line.defensiveRebounds;
    t.steals += line.steals;
    t.blocks += line.blocks;
    t.turnovers += line.turnovers;
    t.fouls += line.fouls;
  }

  for (const id of Object.keys(teams)) withPercentage(teams[id]);
  return teams;
}

/** Convenience: total score for a single team. */
export function calculateTeamScore(
  events: GameEvent[],
  playerTeamMap: Record<string, string>,
  teamId: string,
): number {
  return calculateTeamStats(events, playerTeamMap)[teamId]?.points ?? 0;
}

/**
 * The next sequence number for a game given its existing events.
 * Sequence numbers are 1-based and monotonic per game.
 *
 * NOTE (multi-device, future): with a single iPad logging this is safe. For
 * multiple concurrent devices, max+1 can collide. See sync service TODOs for
 * the planned resolution (server-assigned sequence on push, or a per-device
 * lane + ordering by local_created_at). The unique(game_id, sequence_number)
 * constraint will reject collisions today.
 */
export function getNextSequenceNumber(events: GameEvent[]): number {
  if (events.length === 0) return 1;
  return Math.max(...events.map((e) => e.sequenceNumber)) + 1;
}

/**
 * Returns the most recent `count` active events, newest first — for the
 * "recent events" strip on the logging screen.
 */
export function getRecentEvents(events: GameEvent[], count = 5): GameEvent[] {
  return getActiveEvents(events).slice(-count).reverse();
}

/**
 * Finds the last event that can be undone (the newest active, non-undo event).
 * Returns undefined when there is nothing to undo.
 */
export function getLastUndoableEvent(events: GameEvent[]): GameEvent | undefined {
  const active = getActiveEvents(events);
  return active[active.length - 1];
}
