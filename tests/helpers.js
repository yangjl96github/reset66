// Test fixtures for building app state.
import { addDays } from '../src/logic/dates.js';

export const START = '2026-11-16'; // Monday

export function habit(id, overrides = {}) {
  return {
    id,
    title: id,
    cue: '',
    xp: 10,
    days: [0, 1, 2, 3, 4, 5, 6],
    archived: false,
    archivedAt: null,
    createdAt: '2026-11-15',
    ...overrides,
  };
}

export function makeState({ habits = [habit('a'), habit('b')], logs = {}, program = {} } = {}) {
  return {
    schemaVersion: 2,
    program: {
      startDate: START,
      targetDays: 66,
      dayBoundaryHour: 4,
      graceDays: 1,
      completionThreshold: 1.0,
      ...program,
    },
    habits,
    logs,
    profile: { bonusXp: 0 },
    meta: { lastExportAt: null },
  };
}

/**
 * Build logs from a day pattern starting at `start`, one character per day:
 *   C = every habit done        M = nothing logged (missed)
 *   S = every habit skipped     P = first habit done only (partial)
 *   . = no log entry (same as M, reads better for future/neutral days)
 */
export function logsFromPattern(pattern, habitIds = ['a', 'b'], start = START) {
  const logs = {};
  [...pattern].forEach((ch, i) => {
    const date = addDays(start, i);
    if (ch === 'C') logs[date] = Object.fromEntries(habitIds.map((id) => [id, 'done']));
    else if (ch === 'S') logs[date] = Object.fromEntries(habitIds.map((id) => [id, 'skipped']));
    else if (ch === 'P') logs[date] = { [habitIds[0]]: 'done' };
  });
  return logs;
}

/** Date `n` days after START (n = 0 is the start date). */
export const day = (n) => addDays(START, n);
