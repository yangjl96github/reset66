import { describe, it, expect } from 'vitest';
import { EXPORT_REMIND_DAYS, daysSinceExport, shouldRemindExport } from '../src/logic/backup.js';
import { START, day, makeState } from './helpers.js';

const exportedOn = (date) => ({ ...makeState(), meta: { lastExportAt: date } });

describe('shouldRemindExport', () => {
  it('uses a 14-day interval', () => {
    expect(EXPORT_REMIND_DAYS).toBe(14);
  });

  it('stays quiet before the programme starts', () => {
    expect(shouldRemindExport(makeState(), day(-1))).toBe(false);
    expect(shouldRemindExport(makeState(), day(-30))).toBe(false);
  });

  it('counts from the start date when never exported', () => {
    expect(shouldRemindExport(makeState(), START)).toBe(false);
    expect(shouldRemindExport(makeState(), day(13))).toBe(false);
    expect(shouldRemindExport(makeState(), day(14))).toBe(true);
    expect(shouldRemindExport(makeState(), day(40))).toBe(true);
  });

  it('counts from the last export', () => {
    const state = exportedOn(day(10));
    expect(shouldRemindExport(state, day(23))).toBe(false); // 13 days
    expect(shouldRemindExport(state, day(24))).toBe(true); // 14 days
  });

  it('is cleared by an export today', () => {
    expect(shouldRemindExport(exportedOn(day(30)), day(30))).toBe(false);
  });

  it('copes with a state that has no meta', () => {
    const { meta: _m, ...state } = makeState();
    expect(shouldRemindExport(state, day(14))).toBe(true);
  });
});

describe('daysSinceExport', () => {
  it('reports days since the last export, or null when never exported', () => {
    expect(daysSinceExport(exportedOn(day(1)), day(15))).toBe(14);
    expect(daysSinceExport(makeState(), day(15))).toBeNull();
  });
});
