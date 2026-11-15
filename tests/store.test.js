import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoadError, STORAGE_KEY, loadState, saveState } from '../src/store.js';
import { makeState } from './helpers.js';

/** Minimal in-memory Storage. */
function memoryStorage() {
  const map = new Map();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

let storage;
beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

const v1 = () => {
  const { meta: _meta, ...rest } = makeState({ logs: { '2026-11-16': { a: 'done' } } });
  return { ...rest, schemaVersion: 1 };
};

describe('loadState', () => {
  it('returns null state when nothing is stored', () => {
    expect(loadState()).toEqual({ state: null });
  });

  it('loads a current-version state unchanged', () => {
    const state = makeState();
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    expect(loadState()).toEqual({ state });
  });

  it('migrates v1 data and writes the upgraded state back immediately', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify(v1()));
    const { state, migratedFrom } = loadState();
    expect(migratedFrom).toBe(1);
    expect(state.schemaVersion).toBe(2);
    expect(state.meta).toEqual({ lastExportAt: null });
    expect(state.logs).toEqual(v1().logs);
    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toEqual(state);
  });

  it.each([
    ['unparseable JSON', '{not json'],
    ['a non-state value', '42'],
    ['an invalid structure', JSON.stringify({ ...makeState(), logs: { bad: { a: 'done' } } })],
  ])('keeps a corrupt copy of %s and starts fresh', (_label, raw) => {
    storage.setItem(STORAGE_KEY, raw);
    const result = loadState();
    expect(result.state).toBeNull();
    expect(result.error).toBe(LoadError.CORRUPT);
    expect(storage.getItem(result.backupKey)).toBe(raw);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('leaves data from a newer app version in place', () => {
    const raw = JSON.stringify({ ...makeState(), schemaVersion: 99 });
    storage.setItem(STORAGE_KEY, raw);
    expect(loadState()).toEqual({ state: null, error: LoadError.TOO_NEW });
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.length).toBe(1);
  });

  it('reports unavailable storage', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('SecurityError');
      },
    });
    expect(loadState()).toEqual({ state: null, error: LoadError.UNAVAILABLE });
  });
});

describe('saveState', () => {
  it('writes JSON and reports success', () => {
    const state = makeState();
    expect(saveState(state)).toBe(true);
    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toEqual(state);
  });
});
