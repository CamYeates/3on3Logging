import { create } from 'zustand';
import {
  ActionType,
  calculatePlayerStats,
  calculateTeamStats,
  getNextSequenceNumber as nextSeqFromEvents,
  getRecentEvents,
  type Game,
  type GameEvent,
  type GamePlayer,
} from '@3on3/shared';
import { getDeviceId } from '../lib/device';
import { newUuid } from '../lib/ids';
import {
  getEventsForGame,
  saveEventLocal,
  undoLastEvent,
} from '../db/eventsRepo';
import { getGame, getGamePlayers, getPlayerTeamMap } from '../db/gamesRepo';
import { countPendingSync } from '../db/syncQueueRepo';
import { syncPendingEvents } from '../sync/syncService';
import { getActionDefinition } from '../flow/actionDefinitions';
import type { ActionDefinition, FlowContext, FlowStep } from '../flow/types';

interface GameStoreState {
  // ---- data ----
  game: Game | null;
  players: GamePlayer[];
  events: GameEvent[];
  playerTeamMap: Record<string, string>;
  loading: boolean;

  // ---- sync ----
  pendingSync: number;
  syncing: boolean;
  lastSyncMessage: string | null;

  // ---- active flow ----
  activeAction: ActionDefinition | null;
  stepIndex: number;
  selections: Record<string, string | number | null>;

  // ---- actions ----
  loadGame: (gameId: string) => Promise<void>;
  refresh: () => Promise<void>;

  startAction: (actionType: ActionType) => void;
  selectValue: (value: string | number | null) => Promise<void>;
  back: () => void;
  cancelFlow: () => void;

  undoLast: () => Promise<void>;
  runSync: () => Promise<void>;

  // ---- selectors ----
  currentStep: () => FlowStep | null;
}

function buildContext(state: GameStoreState): FlowContext {
  return {
    gameId: state.game?.id ?? '',
    scoringMode: state.game?.scoringMode ?? 'standard',
    deviceId: getDeviceId(),
    players: state.players.filter((p) => p.active),
    selections: state.selections,
  };
}

/** Advance from `fromIndex` to the next step that should be shown (skipIf). */
function nextVisibleStep(
  steps: FlowStep[],
  fromIndex: number,
  ctx: FlowContext,
): number {
  let i = fromIndex;
  while (i < steps.length && steps[i].skipIf?.(ctx)) i += 1;
  return i;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  game: null,
  players: [],
  events: [],
  playerTeamMap: {},
  loading: false,

  pendingSync: 0,
  syncing: false,
  lastSyncMessage: null,

  activeAction: null,
  stepIndex: 0,
  selections: {},

  loadGame: async (gameId) => {
    set({ loading: true });
    const [game, players, events, playerTeamMap, pendingSync] =
      await Promise.all([
        getGame(gameId),
        getGamePlayers(gameId),
        getEventsForGame(gameId),
        getPlayerTeamMap(gameId),
        countPendingSync(),
      ]);
    set({ game, players, events, playerTeamMap, pendingSync, loading: false });
  },

  refresh: async () => {
    const { game } = get();
    if (!game) return;
    const [events, pendingSync] = await Promise.all([
      getEventsForGame(game.id),
      countPendingSync(),
    ]);
    set({ events, pendingSync });
  },

  startAction: (actionType) => {
    const def = getActionDefinition(actionType);
    if (!def) return;
    set({ activeAction: def, stepIndex: 0, selections: {} });

    // If the action has no steps (none currently), commit immediately.
    if (def.steps.length === 0) {
      void get().selectValue(null);
    }
  },

  selectValue: async (value) => {
    const state = get();
    const def = state.activeAction;
    if (!def) return;

    const step = def.steps[state.stepIndex];
    const selections = { ...state.selections };
    if (step) selections[step.id] = value;

    const ctx: FlowContext = { ...buildContext(state), selections };
    const advanced = nextVisibleStep(def.steps, state.stepIndex + 1, ctx);

    if (advanced < def.steps.length) {
      // More steps remain.
      set({ selections, stepIndex: advanced });
      return;
    }

    // Flow complete — build and persist the event(s).
    const events = def.buildEvents(ctx);
    for (const e of events) {
      await saveEventLocal(e);
    }

    set({ activeAction: null, stepIndex: 0, selections: {} });
    await get().refresh();
  },

  back: () => {
    const state = get();
    const def = state.activeAction;
    if (!def) return;
    if (state.stepIndex === 0) {
      get().cancelFlow();
      return;
    }
    // Step back to the previous visible step.
    let prev = state.stepIndex - 1;
    const ctx = buildContext(state);
    while (prev > 0 && def.steps[prev].skipIf?.(ctx)) prev -= 1;
    set({ stepIndex: prev });
  },

  cancelFlow: () => set({ activeAction: null, stepIndex: 0, selections: {} }),

  undoLast: async () => {
    const { game } = get();
    if (!game) return;
    await undoLastEvent(game.id);
    await get().refresh();
  },

  runSync: async () => {
    set({ syncing: true });
    try {
      const result = await syncPendingEvents();
      set({ lastSyncMessage: result.message });
    } catch (err) {
      set({
        lastSyncMessage: err instanceof Error ? err.message : 'Sync failed',
      });
    } finally {
      const pendingSync = await countPendingSync();
      set({ syncing: false, pendingSync });
    }
  },

  currentStep: () => {
    const { activeAction, stepIndex } = get();
    if (!activeAction) return null;
    return activeAction.steps[stepIndex] ?? null;
  },
}));

// Re-export pure helpers so screens can derive view state without re-importing
// from @3on3/shared everywhere.
export { calculatePlayerStats, calculateTeamStats, getRecentEvents, newUuid };
export const getNextSequenceNumber = nextSeqFromEvents;
