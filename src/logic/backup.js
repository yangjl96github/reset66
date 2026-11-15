// Backup file format: build, serialise and parse the export envelope.
// Pure module: no DOM, no storage, no implicit "now" (instants and dates are passed in).
import { diffDays } from './dates.js';
import { SchemaErrorCode, upgradeState } from './schema.js';

export const BACKUP_APP = 'reset66';
export const BACKUP_FORMAT = 1;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const EXPORT_REMIND_DAYS = 14;

export const ImportErrorCode = Object.freeze({
  NOT_JSON: 'notJson',
  NOT_RESET66: 'notReset66',
  TOO_NEW: 'tooNew',
  INVALID: 'invalid',
  TOO_LARGE: 'tooLarge', // checked by the UI before reading the file
});

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const pad = (n) => String(Math.abs(n)).padStart(2, '0');

/** ISO 8601 in the instant's local time with offset, e.g. 2026-11-20T21:05:00+08:00. */
export function toLocalIsoString(date) {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.trunc(offsetMin / 60))}:${pad(offsetMin % 60)}`
  );
}

export function backupFileName(date) {
  return `reset66-backup-${date}.json`;
}

/** Envelope around a deep copy of the full state. */
export function buildBackup(state, { appVersion, exportedAt }) {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    appVersion,
    exportedAt,
    data: JSON.parse(JSON.stringify(state)),
  };
}

export function serializeBackup(backup) {
  return JSON.stringify(backup, null, 2);
}

/** Record a successful export on `date` (logical YYYY-MM-DD). */
export function markExported(state, date) {
  return { ...state, meta: { ...state.meta, lastExportAt: date } };
}

const fail = (code, errors = []) => ({ ok: false, code, errors });

/**
 * Parse an import file: either an envelope or a bare state (older/manual files).
 * The state is migrated to the current schema and validated.
 * @returns {{ok: true, state: object, exportedAt: string|null, appVersion: string|null}
 *          | {ok: false, code: string, errors: string[]}}
 */
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail(ImportErrorCode.NOT_JSON);
  }
  if (!isPlainObject(parsed)) return fail(ImportErrorCode.NOT_RESET66);

  let data;
  let exportedAt = null;
  let appVersion = null;
  if ('app' in parsed) {
    if (parsed.app !== BACKUP_APP) return fail(ImportErrorCode.NOT_RESET66);
    if (!Number.isInteger(parsed.format) || parsed.format < 1) return fail(ImportErrorCode.INVALID, ['format: missing']);
    if (parsed.format > BACKUP_FORMAT) return fail(ImportErrorCode.TOO_NEW, [`format ${parsed.format}`]);
    if (!isPlainObject(parsed.data)) return fail(ImportErrorCode.INVALID, ['data: missing']);
    data = parsed.data;
    if (typeof parsed.exportedAt === 'string' && !Number.isNaN(Date.parse(parsed.exportedAt))) exportedAt = parsed.exportedAt;
    if (typeof parsed.appVersion === 'string') appVersion = parsed.appVersion;
  } else if ('schemaVersion' in parsed) {
    data = parsed;
  } else {
    return fail(ImportErrorCode.NOT_RESET66);
  }

  const result = upgradeState(data);
  if (!result.ok) {
    return fail(result.code === SchemaErrorCode.TOO_NEW ? ImportErrorCode.TOO_NEW : ImportErrorCode.INVALID, result.errors);
  }
  return { ok: true, state: result.state, exportedAt, appVersion };
}

/** Figures shown in the import preview. */
export function summarizeBackup(state) {
  return {
    startDate: state.program.startDate,
    habitCount: state.habits.length,
    archivedCount: state.habits.filter((h) => h.archived).length,
    loggedDays: Object.values(state.logs).filter((day) => Object.keys(day).length > 0).length,
  };
}

/** Days since the last export, or null when the data has never been exported. */
export function daysSinceExport(state, today) {
  const last = state.meta?.lastExportAt;
  return last ? diffDays(last, today) : null;
}

/**
 * Remind to export once the programme has started and EXPORT_REMIND_DAYS have passed
 * since the last export (or since the start date when never exported).
 */
export function shouldRemindExport(state, today) {
  const { startDate } = state.program;
  if (today < startDate) return false;
  const since = state.meta?.lastExportAt ?? startDate;
  return diffDays(since, today) >= EXPORT_REMIND_DAYS;
}
