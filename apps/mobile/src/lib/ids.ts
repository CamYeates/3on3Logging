import * as Crypto from 'expo-crypto';

/**
 * Generate a UUID v4. Uses expo-crypto's native implementation which is
 * available on device. Falls back gracefully in environments without it.
 */
export function newUuid(): string {
  // expo-crypto >= 12 exposes randomUUID synchronously.
  if (typeof Crypto.randomUUID === 'function') {
    return Crypto.randomUUID();
  }
  // Fallback (should not happen on device).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
