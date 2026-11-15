// XP and levels. All tunable numbers live here.
import { getHistory, isHabitDue, LogStatus } from './progress.js';
import { computeStreak } from './streak.js';

export const DEFAULT_HABIT_XP = 10; // per completed habit, unless habit.xp is set
export const FULL_DAY_BONUS = 20; // every countable habit of the day done (skipped excluded)
export const STREAK_BONUS = 50; // awarded each time the running streak reaches a multiple of…
export const STREAK_BONUS_EVERY = 7; // …this many days
export const LEVEL_XP_FACTOR = 50; // xpToReach(L) = LEVEL_XP_FACTOR * L * (L - 1)

/** Cumulative XP needed to reach `level` (L1 = 0, L2 = 100, L3 = 300, L4 = 600, L5 = 1000…). */
export function xpToReach(level) {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`Invalid level: ${level}`);
  return LEVEL_XP_FACTOR * level * (level - 1);
}

export function levelForXp(xp) {
  if (!(xp > 0)) return 1;
  // Solve FACTOR * L * (L - 1) <= xp for the largest integer L, then fix float drift.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / LEVEL_XP_FACTOR)) / 2));
  while (xpToReach(level + 1) <= xp) level++;
  while (level > 1 && xpToReach(level) > xp) level--;
  return level;
}

export function levelProgress(xp) {
  const total = Math.max(0, xp);
  const level = levelForXp(total);
  const floor = xpToReach(level);
  const next = xpToReach(level + 1);
  return {
    level,
    xpIntoLevel: total - floor,
    xpForNextLevel: next - floor,
    xpToNextLevel: next - total,
    levelRatio: (total - floor) / (next - floor),
  };
}

function habitXp(habit) {
  return Number.isFinite(habit.xp) && habit.xp >= 0 ? habit.xp : DEFAULT_HABIT_XP;
}

/**
 * Total XP derived from logs between program start and today (inclusive).
 * Pass precomputed history/streak to avoid recomputing them.
 */
export function computeXp(state, today, history = getHistory(state, today), streak = null) {
  const streakResult = streak ?? computeStreak(history, state.program.graceDays ?? 1);

  let habitTotal = 0;
  let fullDayBonus = 0;
  for (const day of history) {
    const dayLog = state.logs?.[day.date] ?? {};
    for (const habit of state.habits) {
      if (dayLog[habit.id] === LogStatus.DONE && isHabitDue(habit, day.date)) {
        habitTotal += habitXp(habit);
      }
    }
    if (day.allDone) fullDayBonus += FULL_DAY_BONUS;
  }

  const streakMilestones = streakResult.timeline.filter(
    (t) => t.status === 'complete' && t.streak > 0 && t.streak % STREAK_BONUS_EVERY === 0
  ).length;
  const streakBonus = streakMilestones * STREAK_BONUS;
  const bonusXp = Number.isFinite(state.profile?.bonusXp) ? state.profile.bonusXp : 0;
  const total = habitTotal + fullDayBonus + streakBonus + bonusXp;

  return {
    habitXp: habitTotal,
    fullDayBonus,
    streakBonus,
    streakMilestones,
    bonusXp,
    total,
    ...levelProgress(total),
  };
}
