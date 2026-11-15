// Schema versioning: step-by-step migrations plus structural validation of a whole state.
// Pure module: no DOM, no storage, no implicit "now". Inputs are never mutated.
import { isValidDateStr } from './dates.js';
import { LogStatus } from './progress.js';
import { HABIT_LIMITS, SCHEMA_VERSION } from './state.js';

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;

export const SchemaErrorCode = Object.freeze({
  INVALID: 'invalid', // not a Reset66 state, or structurally broken
  TOO_NEW: 'tooNew', // written by a newer app version
});

export class SchemaError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SchemaError';
    this.code = code;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * MIGRATIONS[n] upgrades a state from version n to n + 1.
 * Each step receives a private deep copy and may modify it.
 */
const MIGRATIONS = {
  1(state) {
    state.meta = isPlainObject(state.meta) ? state.meta : { lastExportAt: null };
    if (!('lastExportAt' in state.meta)) state.meta.lastExportAt = null;
    if (Array.isArray(state.habits)) {
      for (const h of state.habits) {
        if (isPlainObject(h) && h.archivedAt === undefined) h.archivedAt = null;
      }
    }
    state.schemaVersion = 2;
    return state;
  },
};

/**
 * Upgrade raw data to CURRENT_SCHEMA_VERSION. Returns a new object.
 * Throws SchemaError(TOO_NEW) for future versions and SchemaError(INVALID) for unusable input.
 * The result is not validated; call validateState (or use upgradeState) afterwards.
 */
export function migrate(raw) {
  if (!isPlainObject(raw)) throw new SchemaError(SchemaErrorCode.INVALID, 'State must be an object');
  const version = raw.schemaVersion;
  if (!Number.isInteger(version) || version < 1) {
    throw new SchemaError(SchemaErrorCode.INVALID, `Unsupported schemaVersion: ${version}`);
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new SchemaError(SchemaErrorCode.TOO_NEW, `schemaVersion ${version} is newer than ${CURRENT_SCHEMA_VERSION}`);
  }
  let state = clone(raw);
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) state = MIGRATIONS[v](state);
  return state;
}

const isIntIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const charLength = (s) => [...s].length;

function validateProgram(program, errors) {
  if (!isPlainObject(program)) {
    errors.push('program: must be an object');
    return;
  }
  if (!isValidDateStr(program.startDate)) errors.push('program.startDate: invalid date');
  if (!isIntIn(program.targetDays, 1, 1000)) errors.push('program.targetDays: integer 1-1000 expected');
  if (!isIntIn(program.dayBoundaryHour, 0, 23)) errors.push('program.dayBoundaryHour: integer 0-23 expected');
  if (!isIntIn(program.graceDays, 0, 6)) errors.push('program.graceDays: integer 0-6 expected');
  const t = program.completionThreshold;
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > 1) {
    errors.push('program.completionThreshold: number 0-1 expected');
  }
}

function validateHabit(h, i, seenIds, errors) {
  const at = `habits[${i}]`;
  if (!isPlainObject(h)) {
    errors.push(`${at}: must be an object`);
    return;
  }
  if (typeof h.id !== 'string' || !h.id) errors.push(`${at}.id: non-empty string expected`);
  else if (seenIds.has(h.id)) errors.push(`${at}.id: duplicate id ${h.id}`);
  else seenIds.add(h.id);

  if (typeof h.title !== 'string' || !h.title.trim() || charLength(h.title) > HABIT_LIMITS.titleMax) {
    errors.push(`${at}.title: 1-${HABIT_LIMITS.titleMax} characters expected`);
  }
  if (typeof h.cue !== 'string' || charLength(h.cue) > HABIT_LIMITS.cueMax) {
    errors.push(`${at}.cue: string up to ${HABIT_LIMITS.cueMax} characters expected`);
  }
  if (!isIntIn(h.xp, HABIT_LIMITS.xpMin, HABIT_LIMITS.xpMax)) {
    errors.push(`${at}.xp: integer ${HABIT_LIMITS.xpMin}-${HABIT_LIMITS.xpMax} expected`);
  }
  if (
    !Array.isArray(h.days) ||
    h.days.length === 0 ||
    !h.days.every((d) => isIntIn(d, 0, 6)) ||
    new Set(h.days).size !== h.days.length
  ) {
    errors.push(`${at}.days: non-empty list of unique weekdays 0-6 expected`);
  }
  if (typeof h.archived !== 'boolean') errors.push(`${at}.archived: boolean expected`);
  if (h.archived === true ? !isValidDateStr(h.archivedAt) : h.archivedAt !== null && !isValidDateStr(h.archivedAt)) {
    errors.push(`${at}.archivedAt: date expected${h.archived ? ' for an archived habit' : ' or null'}`);
  }
  if (!isValidDateStr(h.createdAt)) errors.push(`${at}.createdAt: invalid date`);
}

function validateLogs(logs, errors) {
  if (!isPlainObject(logs)) {
    errors.push('logs: must be an object');
    return;
  }
  const allowed = new Set([LogStatus.DONE, LogStatus.SKIPPED]);
  for (const [date, day] of Object.entries(logs)) {
    if (!isValidDateStr(date)) errors.push(`logs: invalid date key ${date}`);
    if (!isPlainObject(day)) {
      errors.push(`logs[${date}]: must be an object`);
      continue;
    }
    for (const [habitId, status] of Object.entries(day)) {
      if (!allowed.has(status)) errors.push(`logs[${date}][${habitId}]: status must be done or skipped`);
    }
  }
}

/**
 * Structural check of a current-version state.
 * @returns {{ok: true, state: object} | {ok: false, errors: string[]}}
 */
export function validateState(obj) {
  if (!isPlainObject(obj)) return { ok: false, errors: ['state: must be an object'] };
  const errors = [];
  if (obj.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    errors.push(`schemaVersion: ${CURRENT_SCHEMA_VERSION} expected, got ${obj.schemaVersion}`);
  }
  validateProgram(obj.program, errors);

  if (!Array.isArray(obj.habits)) errors.push('habits: must be an array');
  else {
    const seen = new Set();
    obj.habits.forEach((h, i) => validateHabit(h, i, seen, errors));
  }

  validateLogs(obj.logs, errors);

  if (!isPlainObject(obj.profile) || !isIntIn(obj.profile.bonusXp, 0, Number.MAX_SAFE_INTEGER)) {
    errors.push('profile.bonusXp: non-negative integer expected');
  }
  if (!isPlainObject(obj.meta)) errors.push('meta: must be an object');
  else if (obj.meta.lastExportAt !== null && !isValidDateStr(obj.meta.lastExportAt)) {
    errors.push('meta.lastExportAt: date or null expected');
  }

  return errors.length ? { ok: false, errors } : { ok: true, state: obj };
}

/**
 * migrate + validate in one step.
 * @returns {{ok: true, state: object, migrated: boolean} | {ok: false, code: string, errors: string[]}}
 */
export function upgradeState(raw) {
  let state;
  try {
    state = migrate(raw);
  } catch (err) {
    if (err instanceof SchemaError) return { ok: false, code: err.code, errors: [err.message] };
    throw err;
  }
  const result = validateState(state);
  if (!result.ok) return { ok: false, code: SchemaErrorCode.INVALID, errors: result.errors };
  return { ok: true, state, migrated: raw.schemaVersion !== CURRENT_SCHEMA_VERSION };
}
