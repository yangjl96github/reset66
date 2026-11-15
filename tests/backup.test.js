import { describe, it, expect } from 'vitest';
import {
  BACKUP_APP,
  BACKUP_FORMAT,
  ImportErrorCode,
  backupFileName,
  buildBackup,
  markExported,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  toLocalIsoString,
} from '../src/logic/backup.js';
import { habit, makeState } from './helpers.js';

const sample = () =>
  makeState({
    habits: [habit('a'), habit('b', { archived: true, archivedAt: '2026-11-20' })],
    logs: { '2026-11-16': { a: 'done', b: 'done' }, '2026-11-17': { a: 'skipped' } },
  });

const meta = { appVersion: '0.3.0', exportedAt: '2026-11-20T21:05:00+08:00' };

describe('toLocalIsoString', () => {
  it('formats with the local offset at second precision', () => {
    const text = toLocalIsoString(new Date(2026, 10, 20, 21, 5, 9));
    expect(text).toMatch(/^2026-11-20T21:05:09[+-]\d{2}:\d{2}$/);
    // Round-trips to the same instant.
    expect(new Date(text).getTime()).toBe(new Date(2026, 10, 20, 21, 5, 9).getTime());
  });
});

describe('backupFileName', () => {
  it('uses the logical date', () => {
    expect(backupFileName('2026-11-20')).toBe('reset66-backup-2026-11-20.json');
  });
});

describe('buildBackup', () => {
  it('wraps the full state in the envelope', () => {
    const state = sample();
    expect(buildBackup(state, meta)).toEqual({ app: BACKUP_APP, format: BACKUP_FORMAT, ...meta, data: state });
  });

  it('copies the state instead of referencing it', () => {
    const state = sample();
    const backup = buildBackup(state, meta);
    expect(backup.data).not.toBe(state);
    backup.data.logs['2026-11-16'].a = 'skipped';
    expect(state.logs['2026-11-16'].a).toBe('done');
  });
});

describe('markExported', () => {
  it('sets meta.lastExportAt without touching anything else', () => {
    const state = sample();
    const next = markExported(state, '2026-11-20');
    expect(next.meta).toEqual({ lastExportAt: '2026-11-20' });
    expect({ ...next, meta: state.meta }).toEqual(state);
    expect(state.meta.lastExportAt).toBeNull();
  });
});

describe('parseBackup', () => {
  it('round-trips an exported file to a deep-equal state', () => {
    const state = sample();
    const result = parseBackup(serializeBackup(buildBackup(state, meta)));
    expect(result).toEqual({ ok: true, state, exportedAt: meta.exportedAt, appVersion: '0.3.0' });
  });

  it('accepts a bare state file and migrates v1 data', () => {
    const { meta: _m, ...v1 } = { ...sample(), schemaVersion: 1 };
    const result = parseBackup(JSON.stringify(v1));
    expect(result.ok).toBe(true);
    expect(result.exportedAt).toBeNull();
    expect(result.state.schemaVersion).toBe(2);
    expect(result.state.meta).toEqual({ lastExportAt: null });
    expect(result.state.logs).toEqual(sample().logs);
  });

  it('migrates v1 data inside an envelope', () => {
    const { meta: _m, ...v1 } = { ...sample(), schemaVersion: 1 };
    const text = JSON.stringify({ app: 'reset66', format: 1, appVersion: '0.2.0', exportedAt: meta.exportedAt, data: v1 });
    expect(parseBackup(text)).toMatchObject({ ok: true, state: { schemaVersion: 2 } });
  });

  it.each([
    ['empty text', '', ImportErrorCode.NOT_JSON],
    ['broken JSON', '{"app":', ImportErrorCode.NOT_JSON],
    ['a JSON number', '42', ImportErrorCode.NOT_RESET66],
    ['another app', JSON.stringify({ app: 'other', format: 1, data: {} }), ImportErrorCode.NOT_RESET66],
    ['an unrelated object', JSON.stringify({ hello: 'world' }), ImportErrorCode.NOT_RESET66],
    ['an envelope without data', JSON.stringify({ app: 'reset66', format: 1 }), ImportErrorCode.INVALID],
    ['a newer envelope format', JSON.stringify({ app: 'reset66', format: 2, data: makeState() }), ImportErrorCode.TOO_NEW],
    ['a newer schema', JSON.stringify({ app: 'reset66', format: 1, data: { ...makeState(), schemaVersion: 3 } }), ImportErrorCode.TOO_NEW],
    ['a broken state', JSON.stringify({ app: 'reset66', format: 1, data: { ...makeState(), habits: 'x' } }), ImportErrorCode.INVALID],
  ])('rejects %s', (_label, text, code) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    expect(result.code).toBe(code);
  });

  it('ignores a malformed exportedAt instead of failing', () => {
    const text = JSON.stringify({ app: 'reset66', format: 1, exportedAt: 12, data: makeState() });
    expect(parseBackup(text)).toMatchObject({ ok: true, exportedAt: null });
  });
});

describe('summarizeBackup', () => {
  it('counts habits and days with at least one log', () => {
    const state = { ...sample(), logs: { ...sample().logs, '2026-11-18': {} } };
    expect(summarizeBackup(state)).toEqual({ startDate: '2026-11-16', habitCount: 2, archivedCount: 1, loggedDays: 2 });
  });
});
