import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HABIT_XP,
  FULL_DAY_BONUS,
  STREAK_BONUS,
  xpToReach,
  levelForXp,
  levelProgress,
  computeXp,
} from '../src/logic/xp.js';
import { START, day, habit, makeState, logsFromPattern } from './helpers.js';

describe('xpToReach', () => {
  it('follows 50 * L * (L - 1)', () => {
    expect([1, 2, 3, 4, 5, 10].map(xpToReach)).toEqual([0, 100, 300, 600, 1000, 4500]);
  });

  it('rejects invalid levels', () => {
    expect(() => xpToReach(0)).toThrow(RangeError);
    expect(() => xpToReach(1.5)).toThrow(RangeError);
  });
});

describe('levelForXp', () => {
  it('maps thresholds exactly', () => {
    const cases = [
      [0, 1],
      [99, 1],
      [100, 2],
      [299, 2],
      [300, 3],
      [599, 3],
      [600, 4],
      [999, 4],
      [1000, 5],
      [4499, 9],
      [4500, 10],
    ];
    for (const [xp, level] of cases) expect(levelForXp(xp), `xp=${xp}`).toBe(level);
  });

  it('treats negative or invalid XP as level 1', () => {
    expect(levelForXp(-50)).toBe(1);
    expect(levelForXp(NaN)).toBe(1);
  });

  it('is consistent with xpToReach for many levels', () => {
    for (let level = 1; level <= 200; level++) {
      expect(levelForXp(xpToReach(level))).toBe(level);
      if (level > 1) expect(levelForXp(xpToReach(level) - 1)).toBe(level - 1);
    }
  });
});

describe('levelProgress', () => {
  it('reports progress within the current level', () => {
    expect(levelProgress(150)).toEqual({
      level: 2,
      xpIntoLevel: 50,
      xpForNextLevel: 200,
      xpToNextLevel: 150,
      levelRatio: 0.25,
    });
    expect(levelProgress(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100, levelRatio: 0 });
  });
});

describe('computeXp', () => {
  it('is zero before anything is logged', () => {
    expect(computeXp(makeState(), START)).toMatchObject({ total: 0, level: 1 });
  });

  it('awards habit XP plus the full-day bonus', () => {
    const xp = computeXp(makeState({ logs: logsFromPattern('C') }), START);
    expect(xp).toMatchObject({
      habitXp: 2 * DEFAULT_HABIT_XP,
      fullDayBonus: FULL_DAY_BONUS,
      streakBonus: 0,
      total: 40,
    });
  });

  it('gives no full-day bonus for a partial day, even when it counts as complete', () => {
    const state = makeState({ program: { completionThreshold: 0.5 }, logs: logsFromPattern('P') });
    expect(computeXp(state, START)).toMatchObject({ habitXp: 10, fullDayBonus: 0, total: 10 });
  });

  it('gives the full-day bonus when the rest were skipped', () => {
    const state = makeState({ logs: { [START]: { a: 'done', b: 'skipped' } } });
    expect(computeXp(state, START)).toMatchObject({ habitXp: 10, fullDayBonus: 20, total: 30 });
  });

  it('gives nothing for an all-skipped day', () => {
    expect(computeXp(makeState({ logs: logsFromPattern('S') }), START).total).toBe(0);
  });

  it('uses per-habit XP values', () => {
    const state = makeState({
      habits: [habit('a', { xp: 25 }), habit('b', { xp: 5 })],
      logs: logsFromPattern('C'),
    });
    expect(computeXp(state, START).habitXp).toBe(30);
  });

  it('falls back to the default for invalid habit XP', () => {
    const state = makeState({ habits: [habit('a', { xp: -3 }), habit('b', { xp: 'x' })], logs: logsFromPattern('C') });
    expect(computeXp(state, START).habitXp).toBe(20);
  });

  it('ignores logs before the start date, after today, and for non-due habits', () => {
    const state = makeState({
      habits: [habit('a'), habit('w', { days: [1, 2, 3, 4, 5] })],
      logs: {
        '2026-11-15': { a: 'done' }, // before start
        '2026-11-21': { a: 'done', w: 'done' }, // Saturday: w not due
        '2026-11-22': { a: 'done' }, // after "today"
      },
    });
    expect(computeXp(state, '2026-11-21')).toMatchObject({ habitXp: 10, fullDayBonus: 20 });
  });

  it('awards a streak bonus at every 7th consecutive completion day', () => {
    const seven = computeXp(makeState({ logs: logsFromPattern('C'.repeat(7)) }), day(6));
    expect(seven).toMatchObject({ streakMilestones: 1, streakBonus: STREAK_BONUS });
    expect(seven.total).toBe(7 * 40 + 50);

    const fourteen = computeXp(makeState({ logs: logsFromPattern('C'.repeat(14)) }), day(13));
    expect(fourteen.streakBonus).toBe(2 * STREAK_BONUS);
  });

  it('awards the streak bonus based on streak count, so a forgiven miss delays it', () => {
    const xp = computeXp(makeState({ logs: logsFromPattern('CCCMCCCC') }), day(7));
    expect(xp.streakMilestones).toBe(1); // 7th completion day is index 7
    const notYet = computeXp(makeState({ logs: logsFromPattern('CCCMCCC') }), day(6));
    expect(notYet.streakMilestones).toBe(0);
  });

  it('awards the bonus again after a broken streak is rebuilt', () => {
    const xp = computeXp(makeState({ logs: logsFromPattern('CCCCCCCMMCCCCCCC') }), day(15));
    expect(xp.streakMilestones).toBe(2);
  });

  it('adds profile bonusXp and derives the level', () => {
    const state = makeState({ logs: logsFromPattern('CC') });
    state.profile.bonusXp = 30;
    const xp = computeXp(state, day(1));
    expect(xp.total).toBe(80 + 30);
    expect(xp).toMatchObject({ level: 2, xpIntoLevel: 10 });
  });

  it('keeps archived habit history but stops counting it after archivedAt', () => {
    const state = makeState({
      habits: [habit('a'), habit('b', { archived: true, archivedAt: day(1) })],
      logs: logsFromPattern('CC'),
    });
    const xp = computeXp(state, day(1));
    expect(xp.habitXp).toBe(30); // day 0: a + b, day 1: a only
    expect(xp.fullDayBonus).toBe(40); // both days fully done
  });
});
