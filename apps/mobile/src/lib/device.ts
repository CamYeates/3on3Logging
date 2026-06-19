import { newUuid } from './ids';

/**
 * A stable per-install device identifier, stamped on every event for future
 * multi-device conflict resolution.
 *
 * The canonical value is persisted in the local `app_settings` table and loaded
 * into this module on DB init via `setDeviceId` (see db/database.ts). This
 * module just holds the in-memory copy and provides a last-resort fallback so
 * callers always get a non-empty id synchronously.
 */
let cachedDeviceId: string | null = null;

export function getDeviceId(): string {
  if (!cachedDeviceId) {
    // Fallback only; database.ensureDeviceId() normally sets this on startup.
    cachedDeviceId = newUuid();
  }
  return cachedDeviceId;
}

export function setDeviceId(id: string): void {
  cachedDeviceId = id;
}
