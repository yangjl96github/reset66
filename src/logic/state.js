// Pure state transitions. Every function returns a new state object; inputs are never mutated.
// IDs and dates are passed in by the caller so this module stays deterministic.
import { isValidDateStr } from './dates.js';
import { LogStatus } from './progress.js';
import { DEFAULT_HABIT_XP } from './xp.js';

export const SCHEMA_VERSION = 2;
export const ALL_DAYS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

export const DEFAULT_PROGRAM = Object.freeze({
  targetDays: 66,
  dayBoundaryHour: 4,
  graceDays: 1,
  completionThreshold: 1.0,
});

export const HABIT_LIMITS = Object.freeze({
  titleMax: 40,
  cueMax: 80,
  xpMin: 1,
  xpMax: 100,
});

export const HabitInputError = Object.freeze({
  REQUIRED: 'required',
  TOO_LONG: 'tooLong',
  OUT_OF_RANGE: 'outOfRange',
  EMPTY: 'empty',
});

/**
 * Validate and normalise user-entered habit fields.
 * @returns {{ok: true, value: {title, cue, xp, days}} | {ok: false, errors: Record<string,string>}}
 */
export function normalizeHabitInput(input = {}) {
  const errors = {};

  const title = String(input.title ?? '').trim().replace(/\s+/g, ' ');
  if (!title) errors.title = HabitInputError.REQUIRED;
  else if ([...title].length > HABIT_LIMITS.titleMax) errors.title = HabitInputError.TOO_LONG;

  const cue = String(input.cue ?? '').trim().replace(/\s+/g, ' ');
  if ([...cue].length > HABIT_LIMITS.cueMax) errors.cue = HabitInputError.TOO_LONG;

  const rawXp = input.xp === undefined || input.xp === '' ? DEFAULT_HABIT_XP : Number(input.xp);
  if (!Number.isInteger(rawXp) || rawXp < HABIT_LIMITS.xpMin || rawXp > HABIT_LIMITS.xpMax) {
    errors.xp = HabitInputError.OUT_OF_RANGE;
  }

  const rawDays = input.days === undefined ? ALL_DAYS : input.days;
  const days = Array.isArray(rawDays)
    ? [...new Set(rawDays.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b)
    : [];
  if (days.length === 0) errors.days = HabitInputError.EMPTY;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { title, cue, xp: rawXp, days } };
}

/** Build a habit from already-normalised fields. */
export function createHabit(fields, { id, createdAt }) {
  if (!id) throw new Error('Habit id is required');
  if (!isValidDateStr(createdAt)) throw new RangeError(`Invalid createdAt: ${createdAt}`);
  return {
    id,
    title: fields.title,
    cue: fields.cue ?? '',
    xp: fields.xp ?? DEFAULT_HABIT_XP,
    days: [...(fields.days ?? ALL_DAYS)],
    archived: false,
    archivedAt: null,
    createdAt,
  };
}

export function createInitialState({ startDate, habits = [], program = {} }) {
  if (!isValidDateStr(startDate)) throw new RangeError(`Invalid startDate: ${startDate}`);
  return {
    schemaVersion: SCHEMA_VERSION,
    program: { startDate, ...DEFAULT_PROGRAM, ...program },
    habits: habits.map((h) => ({ ...h, days: [...h.days] })),
    logs: {},
    profile: { bonusXp: 0 },
    meta: { lastExportAt: null },
  };
}

export function getLogStatus(state, date, habitId) {
  return state.logs?.[date]?.[habitId] ?? null;
}

/** Set (or clear with null) one habit's status on a date. Empty days are removed from logs. */
export function setHabitStatus(state, date, habitId, status) {
  if (!isValidDateStr(date)) throw new RangeError(`Invalid date: ${date}`);
  if (status !== null && status !== LogStatus.DONE && status !== LogStatus.SKIPPED) {
    throw new RangeError(`Invalid status: ${status}`);
  }
  const logs = { ...state.logs };
  const day = { ...(logs[date] ?? {}) };
  if (status === null) delete day[habitId];
  else day[habitId] = status;
  if (Object.keys(day).length) logs[date] = day;
  else delete logs[date];
  return { ...state, logs };
}

/** done ↔ nothing; skipped → done. */
export function toggleDone(state, date, habitId) {
  const current = getLogStatus(state, date, habitId);
  return setHabitStatus(state, date, habitId, current === LogStatus.DONE ? null : LogStatus.DONE);
}

/** skipped ↔ nothing; done → skipped. */
export function toggleSkipped(state, date, habitId) {
  const current = getLogStatus(state, date, habitId);
  return setHabitStatus(state, date, habitId, current === LogStatus.SKIPPED ? null : LogStatus.SKIPPED);
}

export function addHabit(state, habit) {
  if (state.habits.some((h) => h.id === habit.id)) throw new Error(`Duplicate habit id: ${habit.id}`);
  return { ...state, habits: [...state.habits, habit] };
}

const EDITABLE_FIELDS = ['title', 'cue', 'xp', 'days'];

/** Update editable fields (title, cue, xp, days) of a habit; other keys in `patch` are ignored. */
export function updateHabit(state, id, patch) {
  let found = false;
  const habits = state.habits.map((h) => {
    if (h.id !== id) return h;
    found = true;
    const next = { ...h };
    for (const key of EDITABLE_FIELDS) {
      if (key in patch) next[key] = key === 'days' ? [...patch.days] : patch[key];
    }
    return next;
  });
  return found ? { ...state, habits } : state;
}

/** Archive a habit from `date` onwards; history before that date keeps counting. */
export function archiveHabit(state, id, date) {
  if (!isValidDateStr(date)) throw new RangeError(`Invalid date: ${date}`);
  let found = false;
  const habits = state.habits.map((h) => {
    if (h.id !== id || h.archived) return h;
    found = true;
    return { ...h, archived: true, archivedAt: date };
  });
  return found ? { ...state, habits } : state;
}

export function activeHabits(state) {
  return state.habits.filter((h) => !h.archived);
}

export function archivedHabits(state) {
  return state.habits.filter((h) => h.archived);
}
