import * as SQLite from 'expo-sqlite';
import { newUuid } from '../lib/ids';
import { setDeviceId } from '../lib/device';
import { SCHEMA_SQL } from './schema';

const DB_NAME = '3on3.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Lazily open (once) and migrate the local database. */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(SCHEMA_SQL);
      await ensureDeviceId(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Read-or-create a persistent device id and load it into the device module. */
async function ensureDeviceId(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    ['device_id'],
  );
  let deviceId = row?.value;
  if (!deviceId) {
    deviceId = newUuid();
    await db.runAsync(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      ['device_id', deviceId],
    );
  }
  setDeviceId(deviceId);
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [key, value],
  );
}

/**
 * Drops and recreates all local tables. Used by the "Reset local database"
 * dev affordance. See README for how to call this.
 */
export async function resetLocalDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DROP TABLE IF EXISTS local_game_events;
    DROP TABLE IF EXISTS local_game_players;
    DROP TABLE IF EXISTS local_players;
    DROP TABLE IF EXISTS local_games;
    DROP TABLE IF EXISTS sync_queue;
    DROP TABLE IF EXISTS app_settings;
  `);
  await db.execAsync(SCHEMA_SQL);
  await ensureDeviceId(db);
}
