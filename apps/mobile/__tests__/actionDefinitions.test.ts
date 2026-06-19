import { ActionType, EventResult, ScoringMode } from '@3on3/shared';
import {
  getActionDefinition,
  ACTION_DEFINITIONS,
} from '../src/flow/actionDefinitions';
import type { FlowContext } from '../src/flow/types';

const P1 = '00000000-0000-0000-0000-000000000001';
const P2 = '00000000-0000-0000-0000-000000000002';
const TEAM_A = '00000000-0000-0000-0000-0000000000a1';

function ctx(selections: Record<string, string | number | null>): FlowContext {
  return {
    gameId: '00000000-0000-0000-0000-0000000000aa',
    scoringMode: ScoringMode.STANDARD,
    deviceId: 'test-device',
    players: [
      { playerId: P1, teamId: TEAM_A } as never,
      { playerId: P2, teamId: TEAM_A } as never,
    ],
    selections,
  };
}

describe('action definitions', () => {
  it('exposes a definition for every main action', () => {
    expect(ACTION_DEFINITIONS.length).toBeGreaterThanOrEqual(11);
    expect(getActionDefinition(ActionType.MADE_SHOT)).toBeDefined();
  });

  it('Score builds a made_shot with linked assist and resolved team', () => {
    const def = getActionDefinition(ActionType.MADE_SHOT)!;
    const events = def.buildEvents(ctx({ player: P1, points: 3, assist: P2 }));
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.actionType).toBe(ActionType.MADE_SHOT);
    expect(e.playerId).toBe(P1);
    expect(e.relatedPlayerId).toBe(P2);
    expect(e.pointValue).toBe(3);
    expect(e.teamId).toBe(TEAM_A);
    expect(e.result).toBe(EventResult.MADE);
    expect(e.clientEventId).toBeTruthy();
  });

  it('Score with No Assist leaves relatedPlayerId null', () => {
    const def = getActionDefinition(ActionType.MADE_SHOT)!;
    const e = def.buildEvents(ctx({ player: P1, points: 2, assist: null }))[0];
    expect(e.relatedPlayerId).toBeNull();
  });

  it('Turnover links the forcing player for a steal credit', () => {
    const def = getActionDefinition(ActionType.TURNOVER)!;
    const e = def.buildEvents(ctx({ player: P1, forcedBy: P2 }))[0];
    expect(e.actionType).toBe(ActionType.TURNOVER);
    expect(e.playerId).toBe(P1);
    expect(e.relatedPlayerId).toBe(P2);
  });

  it('Foul stores the foul type in metadata', () => {
    const def = getActionDefinition(ActionType.FOUL)!;
    const e = def.buildEvents(ctx({ player: P1, foulType: 'shooting' }))[0];
    expect(e.metadata.foulType).toBe('shooting');
  });

  it('Free throw made carries one point', () => {
    const def = getActionDefinition(ActionType.FREE_THROW)!;
    const e = def.buildEvents(ctx({ player: P1, result: EventResult.MADE }))[0];
    expect(e.pointValue).toBe(1);
    expect(e.result).toBe(EventResult.MADE);
  });
});
