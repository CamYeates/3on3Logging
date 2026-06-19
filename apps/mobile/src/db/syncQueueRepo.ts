import { SyncStatus } from '@3on3/shared';
import { newUuid } from '../lib/ids';
import { getDb } from './database';

export type SyncEntityType = 'game' | 'game_player' | 'event';

export interface SyncQueueItem {
  id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  client_event_id: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const nowIso = () => new Date().toISOString();

/**
 * Enqueue an entity for sync. Idempotent per (entity_type, entity_id): if a
 * pending row already exists we leave it; if it errored we reset it to pending.
 */
export async function queueForSync(
  entityType: SyncEntityType,
  entityId: string,
  clientEventId: string | null = null,
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<SyncQueueItem>(
    'SELECT * FROM sync_queue WHERE entity_type = ? AND entity_id = ?',
    [entityType, entityId],
  );
  const now = nowIso();
  if (existing) {
    if (existing.status !== SyncStatus.SYNCED) {
      await db.runAsync(
        'UPDATE sync_queue SET status = ?, updated_at = ? WHERE id = ?',
        [SyncStatus.PENDING, now, existing.id],
      );
    }
    return;
  }
  await db.runAsync(
    `INSERT INTO sync_queue
       (id, entity_type, entity_id, client_event_id, status, attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [newUuid(), entityType, entityId, clientEventId, SyncStatus.PENDING, now, now],
  );
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDb();
  return db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue WHERE status != ? ORDER BY created_at ASC`,
    [SyncStatus.SYNCED],
  );
}

export async function markSyncItemSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE sync_queue SET status = ?, updated_at = ? WHERE id = ?',
    [SyncStatus.SYNCED, nowIso(), id],
  );
}

export async function markSyncItemError(
  id: string,
  error: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sync_queue
       SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ?
     WHERE id = ?`,
    [SyncStatus.ERROR, error, nowIso(), id],
  );
}

export async function countPendingSync(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM sync_queue WHERE status != ?',
    [SyncStatus.SYNCED],
  );
  return row?.c ?? 0;
}
