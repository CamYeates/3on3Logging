import { getDb } from '../db/database';
import { markEventSynced } from '../db/eventsRepo';
import { type GameEventRow, type GameRow } from '../db/mappers';
import {
  getPendingSyncItems,
  markSyncItemError,
  markSyncItemSynced,
  type SyncQueueItem,
} from '../db/syncQueueRepo';
import { isSupabaseConfigured, supabase } from '../supabase/client';

export interface SyncResult {
  pushed: number;
  failed: number;
  skipped: boolean;
  message: string;
}

/** snake_case payload for the cloud game_events table. */
function eventRowToCloud(r: GameEventRow) {
  return {
    id: r.id,
    game_id: r.game_id,
    sequence_number: r.sequence_number,
    client_event_id: r.client_event_id,
    device_id: r.device_id,
    team_id: r.team_id,
    player_id: r.player_id,
    related_player_id: r.related_player_id,
    action_type: r.action_type,
    point_value: r.point_value,
    result: r.result,
    metadata: JSON.parse(r.metadata_json || '{}'),
    created_by: r.created_by,
    local_created_at: r.local_created_at,
    undo_of_event_id: r.undo_of_event_id,
  };
}

/**
 * Push all pending sync_queue items to Supabase.
 *
 * Idempotency: events are upserted on `client_event_id`, so re-pushing the same
 * event is a no-op on the server. Safe to call repeatedly / after retries.
 */
export async function syncPendingEvents(): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      pushed: 0,
      failed: 0,
      skipped: true,
      message: 'Supabase not configured — running offline only.',
    };
  }

  const db = await getDb();
  const items = await getPendingSyncItems();
  let pushed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await pushItem(item);
      await markSyncItemSynced(item.id);
      pushed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markSyncItemError(item.id, message);
      failed += 1;
    }
  }

  return {
    pushed,
    failed,
    skipped: false,
    message: failed
      ? `Synced ${pushed}, ${failed} failed (will retry).`
      : `Synced ${pushed} item(s).`,
  };
}

async function pushItem(item: SyncQueueItem): Promise<void> {
  const db = await getDb();
  if (!supabase) throw new Error('Supabase client unavailable');

  if (item.entity_type === 'game') {
    const row = await db.getFirstAsync<GameRow>(
      'SELECT * FROM local_games WHERE id = ?',
      [item.entity_id],
    );
    if (!row) return; // deleted locally; nothing to push
    await pushGameRow(row);
    return;
  }

  if (item.entity_type === 'game_player') {
    const row = await db.getFirstAsync<{
      id: string;
      game_id: string;
      player_id: string;
      team_id: string;
      name: string;
      jersey_number: string | null;
      active: number;
    }>('SELECT * FROM local_game_players WHERE id = ?', [item.entity_id]);
    if (!row) return;
    // Ensure player exists, then the roster link.
    const { error: pErr } = await supabase.from('players').upsert(
      {
        id: row.player_id,
        team_id: row.team_id,
        name: row.name,
        jersey_number: row.jersey_number,
      },
      { onConflict: 'id' },
    );
    if (pErr) throw pErr;
    const { error } = await supabase.from('game_players').upsert(
      {
        id: row.id,
        game_id: row.game_id,
        player_id: row.player_id,
        team_id: row.team_id,
        active: row.active === 1,
      },
      { onConflict: 'game_id,player_id' },
    );
    if (error) throw error;
    return;
  }

  if (item.entity_type === 'event') {
    const row = await db.getFirstAsync<GameEventRow>(
      'SELECT * FROM local_game_events WHERE id = ?',
      [item.entity_id],
    );
    if (!row) return;
    const { error } = await supabase
      .from('game_events')
      .upsert(eventRowToCloud(row), { onConflict: 'client_event_id' });
    if (error) throw error;
    await markEventSynced(row.id);
  }
}

/** Upsert a game and its two teams to the cloud. */
async function pushGameRow(row: GameRow): Promise<void> {
  if (!supabase) throw new Error('Supabase client unavailable');

  // Teams first (FK target).
  const { error: tErr } = await supabase.from('teams').upsert(
    [
      { id: row.team_a_id, name: row.team_a_name, organization_id: row.organization_id },
      { id: row.team_b_id, name: row.team_b_name, organization_id: row.organization_id },
    ],
    { onConflict: 'id' },
  );
  if (tErr) throw tErr;

  const { error } = await supabase.from('games').upsert(
    {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      location: row.location,
      game_date: row.game_date,
      team_a_id: row.team_a_id,
      team_b_id: row.team_b_id,
      scoring_mode: row.scoring_mode,
      status: row.status,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;

  const db = await getDb();
  await db.runAsync('UPDATE local_games SET synced_at = ? WHERE id = ?', [
    new Date().toISOString(),
    row.id,
  ]);
}

/** Explicit single-game push (used by the "Sync now" button on Summary). */
export async function pushGameToCloud(gameId: string): Promise<SyncResult> {
  // Simply ensures everything queued is flushed. The queue already contains the
  // game, its roster and its events.
  return syncPendingEvents();
}

/**
 * Pull games (and their events) from the cloud into the local DB. Used to hydrate
 * a fresh install or pick up games created on another device.
 *
 * TODO(multi-device): merge strategy here is last-write-wins on game rows and
 * insert-if-absent on events (keyed by client_event_id). Concurrent sequence
 * numbers from multiple devices are NOT yet reconciled — see eventsRepo TODO.
 */
export async function pullGamesFromCloud(): Promise<{ pulled: number }> {
  if (!isSupabaseConfigured() || !supabase) return { pulled: 0 };
  const db = await getDb();

  const { data: games, error } = await supabase.from('games').select('*');
  if (error) throw error;
  if (!games) return { pulled: 0 };

  let pulled = 0;
  for (const g of games as Array<Record<string, unknown>>) {
    // Look up team names.
    const { data: teams } = await supabase
      .from('teams')
      .select('id,name')
      .in('id', [g.team_a_id as string, g.team_b_id as string]);
    const teamName = (id: string) =>
      (teams?.find((t) => t.id === id)?.name as string) ?? 'Team';

    await db.runAsync(
      `INSERT OR REPLACE INTO local_games
         (id, organization_id, name, location, game_date, team_a_id, team_b_id,
          team_a_name, team_b_name, scoring_mode, status, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        g.id as string,
        (g.organization_id as string) ?? null,
        g.name as string,
        (g.location as string) ?? null,
        g.game_date as string,
        g.team_a_id as string,
        g.team_b_id as string,
        teamName(g.team_a_id as string),
        teamName(g.team_b_id as string),
        g.scoring_mode as string,
        g.status as string,
        (g.created_at as string) ?? new Date().toISOString(),
        (g.updated_at as string) ?? new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    pulled += 1;
  }

  return { pulled };
}
