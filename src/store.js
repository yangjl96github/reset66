// localStorage persistence. M2 scope: load/save with a basic shape check.
// M3 adds schema migrations and JSON import/export.
import { isValidDateStr } from './logic/dates.js';

export const STORAGE_KEY = 'reset66.v1';
const CORRUPT_PREFIX = `${STORAGE_KEY}.corrupt.`;

export const LoadError = Object.freeze({
  UNAVAILABLE: 'unavailable', // storage blocked (e.g. private mode)
  CORRUPT: 'corrupt', // unreadable data; raw copy preserved under a backup key
});

function looksLikeState(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    Number.isInteger(value.schemaVersion) &&
    value.program &&
    isValidDateStr(value.program.startDate) &&
    Array.isArray(value.habits) &&
    value.logs !== null &&
    typeof value.logs === 'object'
  );
}

/** @returns {{state: object|null, error?: string, backupKey?: string}} */
export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: null, error: LoadError.UNAVAILABLE };
  }
  if (raw === null) return { state: null };

  try {
    const parsed = JSON.parse(raw);
    if (!looksLikeState(parsed)) throw new Error('Unexpected shape');
    return { state: parsed };
  } catch {
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
