import { describe, it, expect } from 'vitest';
import {
  DayStatus,
  isHabitDue,
  dueHabits,
  evaluateDay,
  getHistory,
  getProgress,
} from '../src/logic/progress.js';
import { START, day, habit, makeState, logsFromPattern } from './helpers.js';

describe('isHabitDue', () => {
  it('respects the weekday schedule (0 = Sunday)', () => {
    const weekdays = habit('w', { days: [1, 2, 3, 4, 5] });
    expect(isHabitDue(weekdays, '2026-11-16')).toBe(true); // Monday
    expect(isHabitDue(weekdays, '2026-11-21')).toBe(false); // Saturday
    expect(isHabitDue(weekdays, '2026-11-22')).toBe(false); // Sunday
  });

  it('defaults to every day when days is missing', () => {
    const h = habit('x');
    delete h.days;
    expect(isHabitDue(h, '2026-11-22')).toBe(true);
  });

  it('is not due before createdAt', () => {
    const h = habit('late', { createdAt: '2026-11-20' });
    expect(isHabitDue(h, '2026-11-19')).toBe(false);
    expect(isHabitDue(h, '2026-11-20')).toBe(true);
  });

  it('stops counting from archivedAt onwards but keeps history before it', () => {
    const h = habit('old', { archived: true, archivedAt: '2026-11-20' });
    expect(isHabitDue(h, '2026-11-19')).toBe(true);
    expect(isHabitDue(h, '2026-11-20')).toBe(false);
    expect(isHabitDue(h, '2026-12-01')).toBe(false);
  });

  it('treats archived without archivedAt as never due', () => {
    const h = habit('legacy', { archived: true, archivedAt: null });
    expect(isHabitDue(h, '2026-11-16')).toBe(false);
  });

  it('dueHabits filters the habit list', () => {
    const state = makeState({ habits: [habit('a'), habit('w', { days: [1, 2, 3, 4, 5] })] });
    expect(dueHabits(state, '2026-11-21').map((h) => h.id)).toEqual(['a']);
  });
});

describe('evaluateDay', () => {
  it('is complete when every due habit is done', () => {
    const state = makeState({ logs: logsFromPattern('C') });
    expect(evaluateDay(state, START)).toMatchObject({
      due: 2,
      done: 2,
      skipped: 0,
      counted: 2,
      ratio: 1,
      allDone: true,
      status: DayStatus.COMPLETE,
    });
  });

  it('is incomplete when only some habits are done at threshold 1.0', () => {
    const state = makeState({ logs: logsFromPattern('P') });
    expect(evaluateDay(state, START)).toMatchObject({ done: 1, ratio: 0.5, status: DayStatus.INCOMPLETE });
  });

  it('removes skipped habits from the denominator', () => {
    const state = makeState({ logs: { [START]: { a: 'done', b: 'skipped' } } });
    expect(evaluateDay(state, START)).toMatchObject({
      counted: 1,
      ratio: 1,
      allDone: true,
      status: DayStatus.COMPLETE,
    });
  });

  it('treats an all-skipped day as a neutral rest day', () => {
    const state = makeState({ logs: logsFromPattern('S') });
    expect(evaluateDay(state, START)).toMatchObject({
      due: 2,
      skipped: 2,
      counted: 0,
      ratio: null,
      allDone: false,
      status: DayStatus.REST,
    });
  });

  it('treats a day with no scheduled habits as a rest day', () => {
    const state = makeState({ habits: [habit('w', { days: [1, 2, 3, 4, 5] })] });
    expect(evaluateDay(state, '2026-11-21').status).toBe(DayStatus.REST);
  });

  it('ignores done logs for habits that are not due', () => {
    const state = makeState({
      habits: [habit('a'), habit('w', { days: [1, 2, 3, 4, 5] })],
      logs: { '2026-11-21': { a: 'done', w: 'done' } },
    });
    expect(evaluateDay(state, '2026-11-21')).toMatchObject({ due: 1, done: 1, status: DayStatus.COMPLETE });
  });

  it('ignores unknown habit ids and unknown statuses', () => {
    const state = makeState({ logs: { [START]: { a: 'done', b: 'maybe', ghost: 'done' } } });
    expect(evaluateDay(state, START)).toMatchObject({ due: 2, done: 1, skipped: 0, status: DayStatus.INCOMPLETE });
  });

  it('honours a partial completionThreshold', () => {
    const state = makeState({ program: { completionThreshold: 0.5 }, logs: logsFromPattern('P') });
    const result = evaluateDay(state, START);
    expect(result.status).toBe(DayStatus.COMPLETE);
    expect(result.allDone).toBe(false);
  });

  it('handles thresholds that are not exact in floating point', () => {
    const habits = ['a', 'b', 'c'].map((id) => habit(id));
    const state = makeState({
      habits,
      program: { completionThreshold: 2 / 3 },
      logs: { [START]: { a: 'done', b: 'done' } },
    });
    expect(evaluateDay(state, START).status).toBe(DayStatus.COMPLETE);
  });

  it('never counts a day with zero done habits, even at threshold 0', () => {
    const state = makeState({ program: { completionThreshold: 0 } });
    expect(evaluateDay(state, START).status).toBe(DayStatus.INCOMPLETE);
  });
});

describe('getHistory', () => {
  it('is empty before the program starts', () => {
    const state = makeState({ logs: { '2026-11-15': { a: 'done', b: 'done' } } });
    expect(getHistory(state, '2026-11-15')).toEqual([]);
  });

  it('marks an unfinished today as pending, not incomplete', () => {
    const state = makeState({ logs: logsFromPattern('CP') });
    const history = getHistory(state, day(1));
    expect(history.map((d) => d.status)).toEqual([DayStatus.COMPLETE, DayStatus.PENDING]);
  });

  it('keeps a finished today as complete', () => {
    const state = makeState({ logs: logsFromPattern('C') });
    expect(getHistory(state, START)[0].status).toBe(DayStatus.COMPLETE);
  });

  it('keeps today as rest when everything is skipped', () => {
    const state = makeState({ logs: logsFromPattern('S') });
    expect(getHistory(state, START)[0].status).toBe(DayStatus.REST);
  });

  it('ignores logs after today', () => {
    const state = makeState({ logs: logsFromPattern('CCCC') });
    expect(getHistory(state, day(1))).toHaveLength(2);
  });

  it('spans month ends correctly', () => {
    const state = makeState({ program: { startDate: '2028-02-27' } });
    expect(getHistory(state, '2028-03-01').map((d) => d.date)).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });
});

describe('getProgress', () => {
  it('reports not started before the start date', () => {
    const progress = getProgress(makeState(), '2026-11-15');
    expect(progress).toMatchObject({
      started: false,
      calendarDay: 0,
      completedDays: 0,
      remainingDays: 66,
      graduated: false,
      today: null,
    });
  });

  it('counts completion days, not calendar days', () => {
    const state = makeState({ logs: logsFromPattern('CMSCP') });
    const progress = getProgress(state, day(4));
    expect(progress).toMatchObject({
      started: true,
      calendarDay: 5,
      completedDays: 2,
      remainingDays: 64,
      graduated: false,
      graduatedOn: null,
    });
    expect(progress.today.status).toBe(DayStatus.PENDING);
    expect(progress.ratio).toBeCloseTo(2 / 66);
  });

  it('graduates on the 66th completion day', () => {
    const pattern = 'C'.repeat(30) + 'M' + 'C'.repeat(36) + 'C';
    const state = makeState({ logs: logsFromPattern(pattern) });
    const progress = getProgress(state, day(pattern.length - 1));
    expect(progress.completedDays).toBe(67);
    expect(progress.graduated).toBe(true);
    expect(progress.graduatedOn).toBe(day(66)); // 30 C + 1 M + 36 C → 66th C is index 66
    expect(progress.remainingDays).toBe(0);
    expect(progress.ratio).toBe(1);
  });

  it('respects a custom targetDays', () => {
    const state = makeState({ program: { targetDays: 3 }, logs: logsFromPattern('CCC') });
    expect(getProgress(state, day(2))).toMatchObject({ graduated: true, graduatedOn: day(2) });
  });
});
