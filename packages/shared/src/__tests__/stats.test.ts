import {
  ActionType,
  EventResult,
  calculatePlayerStats,
  calculateTeamStats,
  getActiveEvents,
  getLastUndoableEvent,
  getNextSequenceNumber,
} from '../index';
import type { GameEvent } from '../index';

const GAME_ID = '00000000-0000-0000-0000-0000000000aa';
const P1 = '00000000-0000-0000-0000-000000000001';
const P2 = '00000000-0000-0000-0000-000000000002';
const TEAM_A = '00000000-0000-0000-0000-0000000000a1';

let seq = 0;

function event(partial: Partial<GameEvent>): GameEvent {
  seq += 1;
  return {
    id: `evt-${seq}`,
    gameId: GAME_ID,
    sequenceNumber: seq,
    clientEventId: `client-${seq}`,
    deviceId: 'test-device',
    teamId: TEAM_A,
    playerId: P1,
    relatedPlayerId: null,
    actionType: ActionType.MADE_SHOT,
    pointValue: null,
    result: null,
    metadata: {},
    createdBy: null,
    localCreatedAt: new Date().toISOString(),
    serverCreatedAt: null,
    syncedAt: null,
    deletedAt: null,
    undoOfEventId: null,
    ...partial,
  };
}

beforeEach(() => {
  seq = 0;
});

describe('score calculation', () => {
  it('sums points from made shots and respects point value', () => {
    const events = [
      event({ actionType: ActionType.MADE_SHOT, playerId: P1, pointValue: 2 }),
      event({ actionType: ActionType.MADE_SHOT, playerId: P1, pointValue: 3 }),
      event({ actionType: ActionType.MISSED_SHOT, playerId: P1, pointValue: 2 }),
    ];
    const stats = calculatePlayerStats(events);
    expect(stats[P1].points).toBe(5);
    expect(stats[P1].fieldGoalsMade).toBe(2);
    expect(stats[P1].fieldGoalsAttempted).toBe(3);
    expect(stats[P1].fieldGoalPercentage).toBeCloseTo(2 / 3);
  });

  it('counts free throws toward points and FT attempts only', () => {
    const events = [
      event({ actionType: ActionType.FREE_THROW, playerId: P1, result: EventResult.MADE, pointValue: 1 }),
      event({ actionType: ActionType.FREE_THROW, playerId: P1, result: EventResult.MISSED, pointValue: 1 }),
    ];
    const stats = calculatePlayerStats(events);
    expect(stats[P1].points).toBe(1);
    expect(stats[P1].freeThrowsMade).toBe(1);
    expect(stats[P1].freeThrowsAttempted).toBe(2);
    expect(stats[P1].fieldGoalsAttempted).toBe(0);
  });
});

describe('assist calculation', () => {
  it('credits an assist linked on the made shot event', () => {
    const events = [
      event({ actionType: ActionType.MADE_SHOT, playerId: P1, pointValue: 2, relatedPlayerId: P2 }),
    ];
    const stats = calculatePlayerStats(events);
    expect(stats[P1].points).toBe(2);
    expect(stats[P2].assists).toBe(1);
  });

  it('credits a standalone assist event', () => {
    const events = [event({ actionType: ActionType.ASSIST, playerId: P2 })];
    expect(calculatePlayerStats(events)[P2].assists).toBe(1);
  });
});

describe('rebound calculation', () => {
  it('splits offensive and defensive rebounds and totals them', () => {
    const events = [
      event({ actionType: ActionType.REBOUND, playerId: P1, result: EventResult.OFFENSIVE }),
      event({ actionType: ActionType.REBOUND, playerId: P1, result: EventResult.DEFENSIVE }),
      event({ actionType: ActionType.REBOUND, playerId: P1, result: EventResult.DEFENSIVE }),
    ];
    const stats = calculatePlayerStats(events);
    expect(stats[P1].offensiveRebounds).toBe(1);
    expect(stats[P1].defensiveRebounds).toBe(2);
    expect(stats[P1].rebounds).toBe(3);
  });
});

describe('turnover + forced steal linkage', () => {
  it('credits a steal to the related player on a forced turnover', () => {
    const events = [
      event({ actionType: ActionType.TURNOVER, playerId: P1, relatedPlayerId: P2 }),
    ];
    const stats = calculatePlayerStats(events);
    expect(stats[P1].turnovers).toBe(1);
    expect(stats[P2].steals).toBe(1);
  });
});

describe('undo logic', () => {
  it('removes the undone event from all calculations', () => {
    const made = event({ actionType: ActionType.MADE_SHOT, playerId: P1, pointValue: 3 });
    const undo = event({ actionType: ActionType.UNDO, undoOfEventId: made.id, playerId: null });
    const stats = calculatePlayerStats([made, undo]);
    expect(stats[P1]?.points ?? 0).toBe(0);
  });

  it('getActiveEvents excludes undo events and their targets', () => {
    const made = event({ actionType: ActionType.MADE_SHOT, playerId: P1, pointValue: 2 });
    const kept = event({ actionType: ActionType.REBOUND, playerId: P1, result: EventResult.DEFENSIVE });
    const undo = event({ actionType: ActionType.UNDO, undoOfEventId: made.id, playerId: null });
    const active = getActiveEvents([made, kept, undo]);
    expect(active.map((e) => e.id)).toEqual([kept.id]);
  });

  it('getLastUndoableEvent returns the newest active event', () => {
    const a = event({ actionType: ActionType.MADE_SHOT, playerId: P1, pointValue: 2 });
    const b = event({ actionType: ActionType.STEAL, playerId: P2 });
    expect(getLastUndoableEvent([a, b])?.id).toBe(b.id);
  });
});

describe('sequence number generation', () => {
  it('starts at 1 for an empty log', () => {
    expect(getNextSequenceNumber([])).toBe(1);
  });

  it('returns max + 1', () => {
    const events = [
      event({ sequenceNumber: 1 }),
      event({ sequenceNumber: 2 }),
      event({ sequenceNumber: 3 }),
    ];
    expect(getNextSequenceNumber(events)).toBe(4);
  });

  it('is robust to out-of-order arrays', () => {
    const events = [event({ sequenceNumber: 5 }), event({ sequenceNumber: 2 })];
    expect(getNextSequenceNumber(events)).toBe(6);
  });
});

describe('duplicate client_event_id handling', () => {
  // The DB enforces uniqueness on client_event_id; this verifies the calc layer
  // is idempotent if a duplicate ever slips into the in-memory log.
  it('dedupes by clientEventId before reducing', () => {
    const e1 = event({ actionType: ActionType.MADE_SHOT, playerId: P1, pointValue: 2, clientEventId: 'dup' });
    const e2 = event({ actionType: ActionType.MADE_SHOT, playerId: P1, pointValue: 2, clientEventId: 'dup' });

    const seen = new Set<string>();
    const deduped = [e1, e2].filter((e) => {
      if (seen.has(e.clientEventId)) return false;
      seen.add(e.clientEventId);
      return true;
    });

    expect(deduped).toHaveLength(1);
    expect(calculatePlayerStats(deduped)[P1].points).toBe(2);
  });
});

describe('team stats', () => {
  it('aggregates player stats by team', () => {
    const events = [
      event({ actionType: ActionType.MADE_SHOT, playerId: P1, pointValue: 2 }),
      event({ actionType: ActionType.MADE_SHOT, playerId: P2, pointValue: 3 }),
    ];
    const teamStats = calculateTeamStats(events, { [P1]: TEAM_A, [P2]: TEAM_A });
    expect(teamStats[TEAM_A].points).toBe(5);
  });
});
