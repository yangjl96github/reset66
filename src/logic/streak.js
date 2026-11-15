// Streak calculation with a rolling-window grace rule.
//
// - A COMPLETE day extends the streak by 1.
// - REST and PENDING days are neutral: they neither extend nor break it.
// - An INCOMPLETE day during a running streak is a "miss". It is forgiven if the number
//   of misses within the last `windowDays` days (inclusive) is <= graceDays; otherwise
//   the streak resets to 0. Forgiven misses do not add to the streak.
// - graceDays = 0 is strict mode: any miss breaks the streak.
import { diffDays } from './dates.js';
import { DayStatus } from './progress.js';

export const GRACE_WINDOW_DAYS = 7;

/**
 * @param {Array<{date: string, status: string}>} history  chronological, from getHistory()
 * @param {number} graceDays
 * @param {number} windowDays
 */
export function computeStreak(history, graceDays = 1, windowDays = GRACE_WINDOW_DAYS) {
  let current = 0;
  let longest = 0;
  let misses = []; // forgiven miss dates belonging to the current streak
  const timeline = [];

  for (const day of history) {
    let broke = false;
    let forgiven = false;

    if (day.status === DayStatus.COMPLETE) {
      current++;
    } else if (day.status === DayStatus.INCOMPLETE && current > 0) {
      misses = misses.filter((m) => diffDays(m, day.date) < windowDays);
      misses.push(day.date);
      if (misses.length > graceDays) {
        current = 0;
        misses = [];
        broke = true;
      } else {
        forgiven = true;
      }
    }

    if (current > longest) longest = current;
    timeline.push({ date: day.date, status: day.status, streak: current, broke, forgiven });
  }

  // Misses still inside the window ending on the last evaluated day (usually today).
  const lastDate = history.length ? history[history.length - 1].date : null;
  const recentMisses = lastDate ? misses.filter((m) => diffDays(m, lastDate) < windowDays).length : 0;

  return {
    current,
    longest,
    graceRemaining: Math.max(0, graceDays - recentMisses),
    timeline,
  };
}
