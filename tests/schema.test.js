import { describe, it, expect } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  SchemaError,
  SchemaErrorCode,
  migrate,
  upgradeState,
  validateState,
} from '../src/logic/schema.js';
import { createHabit, createInitialState } from '../src/logic/state.js';
import { habit, makeState } from './helpers.js';

/** A state exactly as M2 (schema v1) wrote it. */
function v1State() {
  return {
    schemaVersion: 1,
    program: { startDate: '2026-11-16', targetDays: 66, dayBoundaryHour: 4, graceDays: 1, completionThreshold: 1 },
    habits: [
      { id: 'h_a', title: '早起', cue: '鬧鐘響就起床', xp: 10, days: [0, 1, 2, 3, 4, 5, 6], archived: false, archivedAt: null, createdAt: '2026-11-15' },
      // Older M2 builds could omit archivedAt.
      { id: 'h_b', title: '讀書', cue: '', xp: 20, days: [1, 3, 5], archived: false, createdAt: '2026-11-15' },
    ],
    logs: { '2026-11-16': { h_a: 'done', h_b: 'skipped' }, '2026-11-17': { h_a: 'done' } },
    profile: { bonusXp: 0 },
  };
}

const deepFreeze = (obj) => {
  for (const value of Object.values(obj)) if (value && typeof value === 'object') deepFreeze(value);
  return Object.freeze(obj);
};

describe('migrate', () => {
  it('upgrades v1 to v2 by adding meta and defaulting archivedAt', () => {
    const out = migrate(v1State());
    expect(out.schemaVersion).toBe(2);
    expect(out.meta).toEqual({ lastExportAt: null });
    expect(out.habits[1].archivedAt).toBeNull();
    // Everything else is carried over untouched.
    const { schemaVersion: _a, meta: _m, ...rest } = out;
    const { schemaVersion: _b, ...restV1 } = v1State();
    restV1.habits[1].archivedAt = null;
    expect(rest).toEqual(restV1);
  });

  it('does not mutate its input', () => {
    const input = deepFreeze(v1State());
    const snapshot = JSON.parse(JSON.stringify(input));
    const out = migrate(input);
    expect(input).toEqual(snapshot);
    expect(out).not.toBe(input);
    expect(out.habits).not.toBe(input.habits);
  });

  it('returns an equal copy for a current-version state', () => {
    const state = makeState();
    const out = migrate(state);
    expect(out).toEqual(state);
    expect(out).not.toBe(state);
  });

  it('keeps an existing meta when upgrading', () => {
    const input = { ...v1State(), meta: { lastExportAt: '2026-11-20' } };
    expect(migrate(input).meta).toEqual({ lastExportAt: '2026-11-20' });
  });

  it('rejects a newer schema version', () => {
    const input = { ...makeState(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(() => migrate(input)).toThrow(SchemaError);
    try {
      migrate(input);
    } catch (err) {
      expect(err.code).toBe(SchemaErrorCode.TOO_NEW);
    }
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'hello'],
    ['missing version', { program: {} }],
    ['version 0', { schemaVersion: 0 }],
    ['fractional version', { schemaVersion: 1.5 }],
  ])('rejects %s', (_label, input) => {
    expect(() => migrate(input)).toThrow(SchemaError);
  });
});

describe('validateState', () => {
  it('accepts a well-formed v2 state', () => {
    const state = makeState({ logs: { '2026-11-16': { a: 'done', b: 'skipped' } } });
    expect(validateState(state)).toEqual({ ok: true, state });
  });

  it('accepts what createInitialState produces', () => {
    const h = createHabit({ title: '早起' }, { id: 'h_1', createdAt: '2026-11-15' });
    const state = createInitialState({ startDate: '2026-11-16', habits: [h] });
    expect(validateState(state).ok).toBe(true);
  });

  it('accepts an archived habit with an archive date', () => {
    const state = makeState({ habits: [habit('a', { archived: true, archivedAt: '2026-11-20' })] });
    expect(validateState(state).ok).toBe(true);
  });

  const invalid = [
    ['not an object', () => 'x'],
    ['old schema version', (s) => ({ ...s, schemaVersion: 1 })],
    ['newer schema version', (s) => ({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })],
    ['missing program', (s) => ({ ...s, program: undefined })],
    ['bad start date', (s) => ({ ...s, program: { ...s.program, startDate: '2026-02-30' } })],
    ['targetDays zero', (s) => ({ ...s, program: { ...s.program, targetDays: 0 } })],
    ['boundary hour 24', (s) => ({ ...s, program: { ...s.program, dayBoundaryHour: 24 } })],
    ['negative grace days', (s) => ({ ...s, program: { ...s.program, graceDays: -1 } })],
    ['threshold above 1', (s) => ({ ...s, program: { ...s.program, completionThreshold: 1.5 } })],
    ['habits not an array', (s) => ({ ...s, habits: {} })],
    ['duplicate habit ids', (s) => ({ ...s, habits: [habit('a'), habit('a')] })],
    ['empty habit id', (s) => ({ ...s, habits: [habit('')] })],
    ['empty title', (s) => ({ ...s, habits: [habit('a', { title: '' })] })],
    ['numeric title', (s) => ({ ...s, habits: [habit('a', { title: 5 })] })],
    ['xp out of range', (s) => ({ ...s, habits: [habit('a', { xp: 0 })] })],
    ['xp not integer', (s) => ({ ...s, habits: [habit('a', { xp: 2.5 })] })],
    ['empty days', (s) => ({ ...s, habits: [habit('a', { days: [] })] })],
    ['day 7', (s) => ({ ...s, habits: [habit('a', { days: [1, 7] })] })],
    ['duplicate days', (s) => ({ ...s, habits: [habit('a', { days: [1, 1] })] })],
    ['archived without date', (s) => ({ ...s, habits: [habit('a', { archived: true, archivedAt: null })] })],
    ['bad createdAt', (s) => ({ ...s, habits: [habit('a', { createdAt: 'yesterday' })] })],
    ['logs as array', (s) => ({ ...s, logs: [] })],
    ['bad log date key', (s) => ({ ...s, logs: { '2026-13-01': { a: 'done' } } })],
    ['bad log status', (s) => ({ ...s, logs: { '2026-11-16': { a: 'yes' } } })],
    ['log day not an object', (s) => ({ ...s, logs: { '2026-11-16': 'done' } })],
    ['missing meta', (s) => ({ ...s, meta: undefined })],
    ['bad lastExportAt', (s) => ({ ...s, meta: { lastExportAt: 'soon' } })],
    ['negative bonus xp', (s) => ({ ...s, profile: { bonusXp: -5 } })],
  ];

  it.each(invalid)('rejects %s', (_label, mutate) => {
    const result = validateState(mutate(makeState()));
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((e) => typeof e === 'string')).toBe(true);
  });
});

describe('upgradeState', () => {
  it('migrates and validates v1 data, flagging the migration', () => {
    const result = upgradeState(v1State());
    expect(result.ok).toBe(true);
    expect(result.migrated).toBe(true);
    expect(result.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.state.logs).toEqual(v1State().logs);
  });

  it('does not flag a current-version state as migrated', () => {
    const result = upgradeState(makeState());
    expect(result).toMatchObject({ ok: true, migrated: false });
  });

  it('reports too-new data with its own code', () => {
    const result = upgradeState({ ...makeState(), schemaVersion: 99 });
    expect(result).toMatchObject({ ok: false, code: SchemaErrorCode.TOO_NEW });
  });

  it('reports structural problems as invalid', () => {
    expect(upgradeState(null)).toMatchObject({ ok: false, code: SchemaErrorCode.INVALID });
    expect(upgradeState({ ...v1State(), logs: { nope: {} } })).toMatchObject({ ok: false, code: SchemaErrorCode.INVALID });
  });
});
