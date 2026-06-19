import {
  ActionType,
  getLastUndoableEvent,
  newGameEventSchema,
  type GameEvent,
  type NewGameEvent,
} from '@3on3/shared';
import { getDeviceId } from '../lib/device';
import { newUuid } from '../lib/ids';
import { getDb } from './database';
import { rowToGameEvent, type GameEventRow } from './mappers';
import { queueForSync } from './syncQueueRepo';

const nowIso = () => new Date().toISOString();

/**
 * The next sequence number for a game, read straight from the local log.
 *
 * Single-device assumption (MVP): max(sequence_number) + 1 is collision-free.
 *
 * TODO(multi-device): when multiple iPads log the same game, this naive
 * max+1 can produce duplicate sequence numbers. Planned resolution:
 *   1. Keep a per-device monotonic local sequence and let the server assign the
 *      authoritative global sequence_number on push, OR
 *   2. Order events by (local_created_at, device_id) and renumber on pull.
 * The unique(game_id, sequence_number) constraint protects integrity until then.
 */
export async function getNextSequenceNumber(gameId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ maxSeq: number | null }>(
    'SELECT MAX(sequence_number) as maxSeq FROM local_game_events WHERE game_id = ?',
    [gameId],
  );
  return (row?.maxSeq ?? 0) + 1;
}

/**
 * Persist an event locally and enqueue it for sync.
 *
 * - Generates a local UUID `id` and assigns the next `sequence_number`.
 * - Validates the payload with Zod before writing.
 * - Uses `INSERT OR IGNORE` on the unique `client_event_id` so a retried save
 *   is idempotent and never creates a duplicate (duplicate handling).
 */
export async function saveEventLocal(input: NewGameEvent): Promise<GameEvent> {
  const db = await getDb();

  // Fill device id and validate the payload shape.
  const payload: NewGameEvent = {
    ...input,
    deviceId: input.deviceId || getDeviceId(),
    metadata: input.metadata ?? {},
  };
  newGameEventSchema.parse(payload);

  const id = newUuid();
  const sequenceNumber = await getNextSequenceNumber(payload.gameId);
  const localCreatedAt = payload.localCreatedAt ?? nowIso();

  const result = await db.runAsync(
    `INSERT OR IGNORE INTO local_game_events
       (id, game_id, sequence_number, client_event_id, device_id, team_id,
        player_id, related_player_id, action_type, point_value, result,
        metadata_json, created_by, local_created_at, undo_of_event_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.gameId,
      sequenceNumber,
      payload.clientEventId,
      payload.deviceId,
      payload.teamId,
      payload.playerId,
      payload.relatedPlayerId,
      payload.actionType,
      payload.pointValue,
      payload.result,
      JSON.stringify(payload.metadata ?? {}),
      payload.createdBy,
      localCreatedAt,
      payload.undoOfEventId,
    ],
  );

  // If the row already existed (duplicate client_event_id), return the existing.
  if (result.changes === 0) {
    const existing = await db.getFirstAsync<GameEventRow>(
      'SELECT * FROM local_game_events WHERE client_event_id = ?',
      [payload.clientEventId],
    );
    if (existing) return rowToGameEvent(existing);
  }

  await queueForSync('event', id, payload.clientEventId);

  const row = await db.getFirstAsync<GameEventRow>(
    'SELECT * FROM local_game_events WHERE id = ?',
    [id],
  );
  return rowToGameEvent(row as GameEventRow);
}

export async function getEventsForGame(gameId: string): Promise<GameEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GameEventRow>(
    'SELECT * FROM local_game_events WHERE game_id = ? ORDER BY sequence_number ASC',
    [gameId],
  );
  return rows.map(rowToGameEvent);
}

/**
 * Undo the most recent undoable event by appending an UNDO event that points at
 * it. We append (rather than delete) so the log stays append-only and the undo
 * itself syncs cleanly. Stat calculations filter undone events out.
 */
export async function undoLastEvent(gameId: string): Promise<GameEvent | null> {
  const events = await getEventsForGame(gameId);
  const target = getLastUndoableEvent(events);
  if (!target) return null;

  return saveEventLocal({
    gameId,
    clientEventId: newUuid(),
    deviceId: getDeviceId(),
    teamId: target.teamId,
    playerId: null,
    relatedPlayerId: null,
    actionType: ActionType.UNDO,
    pointValue: null,
    result: null,
    metadata: { undoneActionType: target.actionType },
    createdBy: null,
    undoOfEventId: target.id,
  });
}

/** Mark a single local event as synced. */
export async function markEventSynced(
  eventId: string,
  serverCreatedAt?: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_game_events SET synced_at = ?, server_created_at = COALESCE(?, server_created_at) WHERE id = ?',
    [nowIso(), serverCreatedAt ?? null, eventId],
  );
}
