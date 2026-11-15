// localStorage persistence: load (parse → migrate → validate), save.
import { SchemaErrorCode, upgradeState } from './logic/schema.js';

export const STORAGE_KEY = 'reset66.v1';
const CORRUPT_PREFIX = `${STORAGE_KEY}.corrupt.`;

export const LoadError = Object.freeze({
  UNAVAILABLE: 'unavailable', // storage blocked (e.g. private mode)
  CORRUPT: 'corrupt', // unreadable data; raw copy preserved under a backup key
  TOO_NEW: 'tooNew', // written by a newer app version; left untouched until the app updates
});

/** @returns {{state: object|null, error?: string, backupKey?: string, migratedFrom?: number}} */
export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: null, error: LoadError.UNAVAILABLE };
  }
  if (raw === null) return { state: null };

  let parsed;
  let result;
  try {
    parsed = JSON.parse(raw);
    result = upgradeState(parsed);
  } catch {
    result = { ok: false, code: SchemaErrorCode.INVALID };
  }

  if (result.ok) {
    if (result.migrated) {
      // Persist the upgrade right away so the stored copy always matches what the app runs on.
      saveState(result.state);
      return { state: result.state, migratedFrom: parsed.schemaVersion };
    }
    return { state: result.state };
  }

  // Newer data must never be moved or overwritten by an older app; the caller blocks the UI.
  if (result.code === SchemaErrorCode.TOO_NEW) return { state: null, error: LoadError.TOO_NEW };

  // Never silently overwrite unreadable data: keep a copy before the app starts fresh.
  const backupKey = `${CORRUPT_PREFIX}${new Date().toISOString()}`;
  try {
    localStorage.setItem(backupKey, raw);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return { state: null, error: LoadError.UNAVAILABLE };
  }
  return { state: null, error: LoadError.CORRUPT, backupKey };
}

/** @returns {boolean} true when written */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// Pre-import snapshots of the current data, newest first; only the latest BACKUP_KEEP are kept.
export const BACKUP_PREFIX = `${STORAGE_KEY}.backup.`;
export const BACKUP_KEEP = 3;

/** Backup keys, newest first (ISO timestamps sort chronologically). */
export function listBackupKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(BACKUP_PREFIX)) keys.push(key);
  }
  return keys.sort().reverse();
}

/**
 * Copy the stored data to `reset66.v1.backup.<ISO>` before it gets overwritten.
 * @param {Date} now
 * @returns {{ok: boolean, key: string|null}} ok=false means the copy could not be written
 */
export function snapshotCurrentData(now) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ok: true, key: null };
    const key = `${BACKUP_PREFIX}${now.toISOString()}`;
    localStorage.setItem(key, raw);
    for (const old of listBackupKeys().slice(BACKUP_KEEP)) localStorage.removeItem(old);
    return { ok: true, key };
  } catch {
    return { ok: false, key: null };
  }
}
