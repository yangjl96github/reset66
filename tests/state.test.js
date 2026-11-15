import { describe, it, expect } from 'vitest';
import {
  ALL_DAYS,
  DEFAULT_PROGRAM,
  HabitInputError,
  normalizeHabitInput,
  createHabit,
  createInitialState,
  getLogStatus,
  setHabitStatus,
  toggleDone,
  toggleSkipped,
  addHabit,
  updateHabit,
  archiveHabit,
  activeHabits,
  archivedHabits,
} from '../src/logic/state.js';
import { SEED_HABITS } from '../src/logic/seed.js';
import { getProgress } from '../src/logic/progress.js';
import { computeXp } from '../src/logic/xp.js';
import { START, habit, makeState } from './helpers.js';

const deepFreeze = (obj) => {
  Object.values(obj).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(obj);
};

describe('normalizeHabitInput', () => {
  it('trims, collapses whitespace and applies defaults', () => {
    expect(normalizeHabitInput({ title: '  喝水   2L ', cue: ' 帶水瓶 ' })).toEqual({
      ok: true,
      value: { title: '喝水 2L', cue: '帶水瓶', xp: 10, days: [...ALL_DAYS] },
    });
  });

  it('requires a title', () => {
    expect(normalizeHabitInput({ title: '   ' })).toEqual({ ok: false, errors: { title: HabitInputError.REQUIRED } });
  });

  it('limits title and cue length by characters', () => {
    expect(normalizeHabitInput({ title: '字'.repeat(40) }).ok).toBe(true);
    expect(normalizeHabitInput({ title: '字'.repeat(41) }).errors.title).toBe(HabitInputError.TOO_LONG);
    expect(normalizeHabitInput({ title: 'a', cue: 'x'.repeat(81) }).errors.cue).toBe(HabitInputError.TOO_LONG);
  });

  it('validates XP as an integer from 1 to 100, accepting numeric strings', () => {
    expect(normalizeHabitInput({ title: 'a', xp: '25' }).value.xp).toBe(25);
    for (const xp of [0, 101, 2.5, 'abc', -5]) {
      expect(normalizeHabitInput({ title: 'a', xp }).errors?.xp, `xp=${xp}`).toBe(HabitInputError.OUT_OF_RANGE);
    }
  });

  it('dedupes, sorts and filters days, and rejects an empty schedule', () => {
    expect(normalizeHabitInput({ title: 'a', days: [5, 1, '3', 1, 9, -1] }).value.days).toEqual([1, 3, 5]);
    expect(normalizeHabitInput({ title: 'a', days: [] }).errors.days).toBe(HabitInputError.EMPTY);
    expect(normalizeHabitInput({ title: 'a', days: 'x' }).errors.days).toBe(HabitInputError.EMPTY);
  });

  it('reports several errors at once', () => {
    expect(normalizeHabitInput({ title: '', xp: 0, days: [] }).errors).toEqual({
      title: HabitInputError.REQUIRED,
      xp: HabitInputError.OUT_OF_RANGE,
      days: HabitInputError.EMPTY,
    });
  });
});

describe('createHabit / createInitialState', () => {
  it('builds a habit with the schema fields', () => {
    expect(createHabit({ title: '早起', cue: '', xp: 10, days: [1, 2] }, { id: 'h_1', createdAt: '2026-11-15' })).toEqual({
      id: 'h_1',
      title: '早起',
      cue: '',
      xp: 10,
      days: [1, 2],
      archived: false,
      archivedAt: null,
      createdAt: '2026-11-15',
    });
  });

  it('requires an id and a valid createdAt', () => {
    expect(() => createHabit({ title: 'a' }, { createdAt: '2026-11-15' })).toThrow();
    expect(() => createHabit({ title: 'a' }, { id: 'x', createdAt: 'bad' })).toThrow(RangeError);
  });

  it('creates a v2 state with default program settings', () => {
    const h = createHabit({ title: 'a' }, { id: 'h_1', createdAt: '2026-11-15' });
    const state = createInitialState({ startDate: '2026-11-16', habits: [h] });
    expect(state).toEqual({
      schemaVersion: 2,
      program: { startDate: '2026-11-16', ...DEFAULT_PROGRAM },
      habits: [h],
      logs: {},
      profile: { bonusXp: 0 },
      meta: { lastExportAt: null },
    });
    expect(state.habits[0]).not.toBe(h);
  });

  it('rejects an invalid start date', () => {
    expect(() => createInitialState({ startDate: '2026-02-30' })).toThrow(RangeError);
  });

  it('builds a working state from the seed habits', () => {
    const habits = SEED_HABITS.map((s, i) => {
      const n = normalizeHabitInput(s);
      expect(n.ok).toBe(true);
      return createHabit(n.value, { id: `h_${i}`, createdAt: '2026-11-15' });
    });
    expect(habits).toHaveLength(6);
    const state = createInitialState({ startDate: START, habits });
    expect(getProgress(state, START).today.due).toBe(6);
  });
});

describe('log transitions', () => {
  const base = deepFreeze(makeState());

  it('setHabitStatus sets and clears without mutating the input', () => {
    const s1 = setHabitStatus(base, START, 'a', 'done');
    expect(s1.logs).toEqual({ [START]: { a: 'done' } });
    expect(base.logs).toEqual({});
    const s2 = setHabitStatus(s1, START, 'a', null);
    expect(s2.logs).toEqual({}); // empty day removed
  });

  it('setHabitStatus validates input', () => {
    expect(() => setHabitStatus(base, START, 'a', 'maybe')).toThrow(RangeError);
    expect(() => setHabitStatus(base, '2026-13-01', 'a', 'done')).toThrow(RangeError);
  });

  it('toggleDone cycles none → done → none and turns skipped into done', () => {
    let s = toggleDone(base, START, 'a');
    expect(getLogStatus(s, START, 'a')).toBe('done');
    s = toggleDone(s, START, 'a');
    expect(getLogStatus(s, START, 'a')).toBe(null);
    s = toggleDone(toggleSkipped(s, START, 'a'), START, 'a');
    expect(getLogStatus(s, START, 'a')).toBe('done');
  });

  it('toggleSkipped cycles none → skipped → none and turns done into skipped', () => {
    let s = toggleSkipped(base, START, 'a');
    expect(getLogStatus(s, START, 'a')).toBe('skipped');
    s = toggleSkipped(s, START, 'a');
    expect(getLogStatus(s, START, 'a')).toBe(null);
    s = toggleSkipped(toggleDone(s, START, 'a'), START, 'a');
    expect(getLogStatus(s, START, 'a')).toBe('skipped');
  });

  it('keeps other habits and days intact', () => {
    let s = toggleDone(base, START, 'a');
    s = toggleDone(s, START, 'b');
    s = toggleDone(s, '2026-11-17', 'a');
    s = toggleDone(s, START, 'a');
    expect(s.logs).toEqual({ [START]: { b: 'done' }, '2026-11-17': { a: 'done' } });
  });

  it('drives progress and XP end to end', () => {
    let s = toggleDone(base, START, 'a');
    expect(getProgress(s, START).completedDays).toBe(0);
    s = toggleDone(s, START, 'b');
    expect(getProgress(s, START).completedDays).toBe(1);
    expect(computeXp(s, START).total).toBe(40);
  });
});

describe('habit transitions', () => {
  const base = deepFreeze(makeState({ habits: [habit('a'), habit('b')] }));

  it('addHabit appends and rejects duplicate ids', () => {
    const s = addHabit(base, habit('c'));
    expect(s.habits.map((h) => h.id)).toEqual(['a', 'b', 'c']);
    expect(() => addHabit(s, habit('a'))).toThrow();
  });

  it('updateHabit changes only editable fields', () => {
    const s = updateHabit(base, 'a', { title: '新', xp: 20, days: [1], id: 'hack', createdAt: '2000-01-01' });
    expect(s.habits[0]).toMatchObject({ id: 'a', title: '新', xp: 20, days: [1], createdAt: '2026-11-15' });
    expect(base.habits[0].title).toBe('a');
  });

  it('updateHabit returns the same state for an unknown id', () => {
    expect(updateHabit(base, 'zzz', { title: 'x' })).toBe(base);
  });

  it('archiveHabit sets archived and archivedAt once', () => {
    const s = archiveHabit(base, 'a', '2026-11-20');
    expect(s.habits[0]).toMatchObject({ archived: true, archivedAt: '2026-11-20' });
    expect(archiveHabit(s, 'a', '2026-12-01')).toBe(s); // already archived: unchanged
    expect(activeHabits(s).map((h) => h.id)).toEqual(['b']);
    expect(archivedHabits(s).map((h) => h.id)).toEqual(['a']);
  });

  it('archiveHabit validates the date and ignores unknown ids', () => {
    expect(() => archiveHabit(base, 'a', 'nope')).toThrow(RangeError);
    expect(archiveHabit(base, 'zzz', '2026-11-20')).toBe(base);
  });
});
