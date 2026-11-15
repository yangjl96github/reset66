import { describe, it, expect } from 'vitest';
import { computeStreak } from '../src/logic/streak.js';
import { getHistory } from '../src/logic/progress.js';
import { day, makeState, logsFromPattern } from './helpers.js';

/** Streak for a day pattern (see logsFromPattern); today is the last character. */
function streakFor(pattern, graceDays = 1) {
  const state = makeState({ program: { graceDays }, logs: logsFromPattern(pattern) });
  return computeStreak(getHistory(state, day(pattern.length - 1)), graceDays);
}

describe('computeStreak — basics', () => {
  it('is zero with no history', () => {
    expect(computeStreak([], 1)).toEqual({ current: 0, longest: 0, graceRemaining: 1, timeline: [] });
  });

  it('counts consecutive completion days', () => {
    const s = streakFor('CCCC');
    expect(s.current).toBe(4);
    expect(s.longest).toBe(4);
    expect(s.timeline.map((t) => t.streak)).toEqual([1, 2, 3, 4]);
  });

  it('does not break or extend on a pending today', () => {
    const s = streakFor('CCCM'); // last day is today → pending
    expect(s.current).toBe(3);
    expect(s.timeline.at(-1)).toMatchObject({ status: 'pending', broke: false, forgiven: false });
  });

  it('counts today once it is complete', () => {
    expect(streakFor('CCCC').current).toBe(4);
  });

  it('misses before any streak exists do nothing', () => {
    const s = streakFor('MMMCC');
    expect(s.current).toBe(2);
    expect(s.timeline.slice(0, 3).every((t) => !t.broke && !t.forgiven)).toBe(true);
  });
});

describe('computeStreak — grace rule (graceDays = 1)', () => {
  it('forgives a single missed day', () => {
    const s = streakFor('CCMCC');
    expect(s.current).toBe(4); // the missed day itself does not count
    expect(s.timeline[2]).toMatchObject({ status: 'incomplete', forgiven: true, streak: 2 });
    expect(s.graceRemaining).toBe(0);
  });

  it('breaks on two consecutive missed days', () => {
    const s = streakFor('CCMMC');
    expect(s.timeline[3]).toMatchObject({ broke: true, streak: 0 });
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
  });

  it('breaks on two misses within the same 7-day window', () => {
    // misses at index 2 and 8 → 6 days apart, both inside one window
    const s = streakFor('CCMCCCCCMC');
    expect(s.timeline[8].broke).toBe(true);
    expect(s.current).toBe(1);
  });

  it('allows misses exactly 7 days apart (window has rolled past the first)', () => {
    // misses at index 2 and 9 → 7 days apart
    const s = streakFor('CCMCCCCCCMC');
    expect(s.timeline[9]).toMatchObject({ forgiven: true, broke: false });
    expect(s.current).toBe(9);
  });

  it('restores grace once the old miss leaves the window', () => {
    expect(streakFor('CCMCCC').graceRemaining).toBe(0); // miss 3 days ago
    expect(streakFor('CCMCCCCCC').graceRemaining).toBe(0); // miss 6 days ago, still in window
    expect(streakFor('CCMCCCCCCC').graceRemaining).toBe(1); // miss 7 days ago, out of window
  });

  it('rebuilds after a break and keeps the longest', () => {
    const s = streakFor('CCCCCMMCC');
    expect(s.current).toBe(2);
    expect(s.longest).toBe(5);
  });
});

describe('computeStreak — strict mode (graceDays = 0)', () => {
  it('breaks on any single miss', () => {
    const s = streakFor('CCMC', 0);
    expect(s.timeline[2].broke).toBe(true);
    expect(s.current).toBe(1);
    expect(s.graceRemaining).toBe(0);
  });
});

describe('computeStreak — larger grace', () => {
  it('graceDays = 2 tolerates two misses per window', () => {
    expect(streakFor('CCMCMCC', 2).current).toBe(5);
    expect(streakFor('CCMMMC', 2).current).toBe(1);
  });
});

describe('computeStreak — neutral days', () => {
  it('all-skipped days neither break nor extend the streak', () => {
    const s = streakFor('CCSSSCC', 0);
    expect(s.current).toBe(4);
    expect(s.timeline.slice(2, 5).map((t) => t.streak)).toEqual([2, 2, 2]);
  });

  it('rest days do not consume grace', () => {
    const s = streakFor('CSMC');
    expect(s.current).toBe(2);
    expect(s.timeline[2].forgiven).toBe(true);
  });

  it('partial days count as misses at threshold 1.0', () => {
    const s = streakFor('CCPPC');
    expect(s.timeline[3].broke).toBe(true);
    expect(s.current).toBe(1);
  });

  it('works across a month end', () => {
    const state = makeState({
      program: { startDate: '2028-02-26' },
      logs: logsFromPattern('CCCMC', ['a', 'b'], '2028-02-26'),
    });
    const s = computeStreak(getHistory(state, '2028-03-01'), 1);
    expect(s.timeline.map((t) => t.date)).toEqual([
      '2028-02-26',
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
    expect(s.current).toBe(4);
  });
});
