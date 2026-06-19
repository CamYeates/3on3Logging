import {
  ActionType,
  EventResult,
  FIELD_GOAL_VALUES,
  FoulType,
  type NewGameEvent,
} from '@3on3/shared';
import { newUuid } from '../lib/ids';
import { colors } from '../theme';
import {
  getSelectedPlayerId,
  getTeamIdForPlayer,
  type ActionDefinition,
  type FlowContext,
} from './types';

/** Base fields shared by every newly-built event. */
function baseEvent(ctx: FlowContext): Pick<
  NewGameEvent,
  'gameId' | 'clientEventId' | 'deviceId' | 'createdBy' | 'undoOfEventId' | 'metadata'
> {
  return {
    gameId: ctx.gameId,
    clientEventId: newUuid(),
    deviceId: ctx.deviceId,
    createdBy: null,
    undoOfEventId: null,
    metadata: {},
  };
}

const pointValueOptions = (ctx: FlowContext) =>
  FIELD_GOAL_VALUES[ctx.scoringMode].map((v) => ({
    label: `${v} PT`,
    value: v,
  }));

/**
 * SCORE
 * player -> point value -> assist (optional) -> made_shot event (assist linked).
 */
const scoreAction: ActionDefinition = {
  actionType: ActionType.MADE_SHOT,
  label: 'Score',
  color: colors.success,
  steps: [
    { id: 'player', kind: 'player', title: 'Who scored?' },
    {
      id: 'points',
      kind: 'option',
      title: 'How many points?',
      options: pointValueOptions,
    },
    {
      id: 'assist',
      kind: 'player-optional',
      title: 'Assisted by?',
      noneLabel: 'No Assist',
      // Assist must come from the same team as the scorer.
      teamFilter: (ctx) =>
        getTeamIdForPlayer(ctx, getSelectedPlayerId(ctx, 'player')),
    },
  ],
  buildEvents: (ctx) => {
    const playerId = getSelectedPlayerId(ctx, 'player');
    const assistId = getSelectedPlayerId(ctx, 'assist');
    const pointValue = Number(ctx.selections.points ?? 0);
    return [
      {
        ...baseEvent(ctx),
        teamId: getTeamIdForPlayer(ctx, playerId),
        playerId,
        // Assist is linked directly on the made_shot event.
        relatedPlayerId: assistId,
        actionType: ActionType.MADE_SHOT,
        pointValue,
        result: EventResult.MADE,
      },
    ];
  },
};

/** MISS: player -> shot value -> missed_shot event. */
const missAction: ActionDefinition = {
  actionType: ActionType.MISSED_SHOT,
  label: 'Miss',
  color: colors.surfaceAlt,
  steps: [
    { id: 'player', kind: 'player', title: 'Who missed?' },
    {
      id: 'points',
      kind: 'option',
      title: 'Shot value?',
      options: pointValueOptions,
    },
  ],
  buildEvents: (ctx) => {
    const playerId = getSelectedPlayerId(ctx, 'player');
    return [
      {
        ...baseEvent(ctx),
        teamId: getTeamIdForPlayer(ctx, playerId),
        playerId,
        relatedPlayerId: null,
        actionType: ActionType.MISSED_SHOT,
        pointValue: Number(ctx.selections.points ?? 0),
        result: EventResult.MISSED,
      },
    ];
  },
};

/** REBOUND: player -> offensive/defensive -> rebound event. */
const reboundAction: ActionDefinition = {
  actionType: ActionType.REBOUND,
  label: 'Rebound',
  color: colors.primary,
  steps: [
    { id: 'player', kind: 'player', title: 'Who rebounded?' },
    {
      id: 'type',
      kind: 'option',
      title: 'Rebound type?',
      options: () => [
        { label: 'Offensive', value: EventResult.OFFENSIVE },
        { label: 'Defensive', value: EventResult.DEFENSIVE },
      ],
    },
  ],
  buildEvents: (ctx) => {
    const playerId = getSelectedPlayerId(ctx, 'player');
    return [
      {
        ...baseEvent(ctx),
        teamId: getTeamIdForPlayer(ctx, playerId),
        playerId,
        relatedPlayerId: null,
        actionType: ActionType.REBOUND,
        pointValue: null,
        result: String(ctx.selections.type),
      },
    ];
  },
};

/** ASSIST (standalone): player -> assist event. */
const assistAction: ActionDefinition = {
  actionType: ActionType.ASSIST,
  label: 'Assist',
  color: colors.primary,
  steps: [{ id: 'player', kind: 'player', title: 'Who assisted?' }],
  buildEvents: (ctx) => {
    const playerId = getSelectedPlayerId(ctx, 'player');
    return [
      {
        ...baseEvent(ctx),
        teamId: getTeamIdForPlayer(ctx, playerId),
        playerId,
        relatedPlayerId: null,
        actionType: ActionType.ASSIST,
        pointValue: null,
        result: null,
      },
    ];
  },
};

/** STEAL: player -> steal event. */
const stealAction: ActionDefinition = {
  actionType: ActionType.STEAL,
  label: 'Steal',
  color: colors.primary,
  steps: [{ id: 'player', kind: 'player', title: 'Who stole it?' }],
  buildEvents: (ctx) => {
    const playerId = getSelectedPlayerId(ctx, 'player');
    return [
      {
        ...baseEvent(ctx),
        teamId: getTeamIdForPlayer(ctx, playerId),
        playerId,
        relatedPlayerId: null,
        actionType: ActionType.STEAL,
        pointValue: null,
        result: null,
      },
    ];
  },
};

/** BLOCK: blocker -> (optional) shooter blocked -> block event. */
const blockAction: ActionDefinition = {
  actionType: ActionType.BLOCK,
  label: 'Block',
  color: colors.primary,
  steps: [
    { id: 'player', kind: 'player', title: 'Who blocked it?' },
    {
      id: 'shooter',
      kind: 'player-optional',
      title: 'Shooter blocked?',
      noneLabel: 'Skip',
    },
  ],
  buildEvents: (ctx) => {
    const playerId = getSelectedPlayerId(ctx, 'player');
    return [
      {
        ...baseEvent(ctx),
        teamId: getTeamIdForPlayer(ctx, playerId),
        playerId,
        relatedPlayerId: getSelectedPlayerId(ctx, 'shooter'),
        actionType: ActionType.BLOCK,
        pointValue: null,
        result: null,
      },
    ];
  },
};

/**
 * TURNOVER: player -> (optional) forced by -> turnover event with steal linked.
 * The forced-by player gets a steal credited via related_player_id (see stats).
 */
const turnoverAction: ActionDefinition = {
  actionType: ActionType.TURNOVER,
  label: 'Turnover',
  color: colors.danger,
  steps: [
    { id: 'player', kind: 'player', title: 'Who turned it over?' },
    {
      id: 'forcedBy',
      kind: 'player-optional',
      title: 'Forced by?',
      noneLabel: 'No Forced Turnover',
    },
  ],
  buildEvents: (ctx) => {
    const playerId = getSelectedPlayerId(ctx, 'player');
    return [
      {
        ...baseEvent(ctx),
        teamId: getTeamIdForPlayer(ctx, playerId),
        playerId,
        relatedPlayerId: getSelectedPlayerId(ctx, 'forcedBy'),
        actionType: ActionType.TURNOVER,
        pointValue: null,
        result: null,
      },
    ];
  },
};

/** FOUL: player -> foul type -> foul event (type in metadata). */
const foulAction: ActionDefinition = {
  actionType: ActionType.FOUL,
  label: 'Foul',
  color: colors.warning,
  steps: [
    { id: 'player', kind: 'player', title: 'Who fouled?' },
    {
      id: 'foulType',
      kind: 'option',
      title: 'Foul type?',
      options: () => [
        { label: 'Personal', value: FoulType.PERSONAL },
        { label: 'Shooting', value: FoulType.SHOOTING },
        { label: 'Offensive', value: FoulType.OFFENSIVE },
        { label: 'Technical', value: FoulType.TECHNICAL },
      ],
    },
  ],
  buildEvents: (ctx) => {
    const playerId = getSelectedPlayerId(ctx, 'player');
    return [
      {
        ...baseEvent(ctx),
        teamId: getTeamIdForPlayer(ctx, playerId),
        playerId,
        relatedPlayerId: null,
        actionType: ActionType.FOUL,
        pointValue: null,
        result: null,
        metadata: { foulType: String(ctx.selections.foulType) as FoulType },
      },
    ];
  },
};

/** FREE THROW: shooter -> made/missed -> free_throw event. */
const freeThrowAction: ActionDefinition = {
  actionType: ActionType.FREE_THROW,
  label: 'Free Throw',
  color: colors.success,
  steps: [
    { id: 'player', kind: 'player', title: 'Who is shooting?' },
    {
      id: 'result',
      kind: 'option',
      title: 'Made or missed?',
      options: () => [
        { label: 'Made', value: EventResult.MADE, color: colors.success },
        { label: 'Missed', value: EventResult.MISSED, color: colors.danger },
      ],
    },
  ],
  buildEvents: (ctx) => {
    const playerId = getSelectedPlayerId(ctx, 'player');
    const result = String(ctx.selections.result);
    return [
      {
        ...baseEvent(ctx),
        teamId: getTeamIdForPlayer(ctx, playerId),
        playerId,
        relatedPlayerId: null,
        actionType: ActionType.FREE_THROW,
        pointValue: 1,
        result,
      },
    ];
  },
};

/** SUBSTITUTION: player out -> player in -> substitution event. */
const substitutionAction: ActionDefinition = {
  actionType: ActionType.SUBSTITUTION,
  label: 'Substitution',
  color: colors.surfaceAlt,
  steps: [
    { id: 'out', kind: 'player', title: 'Who is coming out?' },
    {
      id: 'in',
      kind: 'player',
      title: 'Who is coming in?',
      teamFilter: (ctx) =>
        getTeamIdForPlayer(ctx, getSelectedPlayerId(ctx, 'out')),
    },
  ],
  buildEvents: (ctx) => {
    const outId = getSelectedPlayerId(ctx, 'out');
    const inId = getSelectedPlayerId(ctx, 'in');
    return [
      {
        ...baseEvent(ctx),
        teamId: getTeamIdForPlayer(ctx, outId),
        playerId: outId,
        relatedPlayerId: inId,
        actionType: ActionType.SUBSTITUTION,
        pointValue: null,
        result: null,
        metadata: { playerOutId: outId ?? undefined, playerInId: inId ?? undefined },
      },
    ];
  },
};

/** TIMEOUT: choose team -> timeout event (no player). */
const timeoutAction: ActionDefinition = {
  actionType: ActionType.TIMEOUT,
  label: 'Timeout',
  color: colors.surfaceAlt,
  steps: [
    {
      id: 'team',
      kind: 'option',
      title: 'Which team?',
      // Options are injected at render time from the game's two teams. We use a
      // placeholder here; the screen overrides team options (see log screen).
      options: () => [],
    },
  ],
  buildEvents: (ctx) => {
    const teamId = ctx.selections.team ? String(ctx.selections.team) : null;
    return [
      {
        ...baseEvent(ctx),
        teamId,
        playerId: null,
        relatedPlayerId: null,
        actionType: ActionType.TIMEOUT,
        pointValue: null,
        result: null,
      },
    ];
  },
};

/** Registry keyed by action type. The main screen renders one button each. */
export const ACTION_DEFINITIONS: ActionDefinition[] = [
  scoreAction,
  missAction,
  reboundAction,
  assistAction,
  stealAction,
  blockAction,
  turnoverAction,
  foulAction,
  freeThrowAction,
  substitutionAction,
  timeoutAction,
];

export function getActionDefinition(
  actionType: ActionType,
): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find((a) => a.actionType === actionType);
}
