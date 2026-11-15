// Day evaluation and overall programme progress, derived purely from state + "today".
import { dateRange, dayOfWeek, diffDays } from './dates.js';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const EPSILON = 1e-9;

export const DayStatus = Object.freeze({
  COMPLETE: 'complete', // met completionThreshold
  INCOMPLETE: 'incomplete', // past day that missed the threshold
  PENDING: 'pending', // today, not (yet) complete; never breaks a streak
  REST: 'rest', // nothing countable (no habits due, or all skipped); neutral
});

export const LogStatus = Object.freeze({ DONE: 'done', SKIPPED: 'skipped' });

/**
 * Whether a habit counts on a given date.
 * - not before its createdAt
 * - scheduled on that weekday
 * - an archived habit stops counting from archivedAt onwards (all days if archivedAt is missing)
 */
export function isHabitDue(habit, date) {
  if (habit.createdAt && date < habit.createdAt) return false;
  if (habit.archived && (!habit.archivedAt || date >= habit.archivedAt)) return false;
  const days = Array.isArray(habit.days) ? habit.days : ALL_DAYS;
  return days.includes(dayOfWeek(date));
}

export function dueHabits(state, date) {
  return state.habits.filter((habit) => isHabitDue(habit, date));
}

/**
 * Evaluate one date. Skipped habits are removed from the denominator.
 * Status is never PENDING here; getHistory applies that to today.
 */
export function evaluateDay(state, date) {
  const dayLog = state.logs?.[date] ?? {};
  const threshold = state.program.completionThreshold ?? 1;

  let due = 0;
  let done = 0;
  let skipped = 0;
  for (const habit of state.habits) {
    if (!isHabitDue(habit, date)) continue;
    due++;
    const status = dayLog[habit.id];
    if (status === LogStatus.DONE) done++;
    else if (status === LogStatus.SKIPPED) skipped++;
  }

  const counted = due - skipped;
  const ratio = counted > 0 ? done / counted : null;

  let status;
  if (counted === 0) status = DayStatus.REST;
  else if (done > 0 && ratio >= threshold - EPSILON) status = DayStatus.COMPLETE;
  else status = DayStatus.INCOMPLETE;

  return {
    date,
    due,
    done,
    skipped,
    counted,
    ratio,
    allDone: counted > 0 && done === counted,
    status,
  };
}

/**
 * Evaluations for every date from program.startDate through today (inclusive).
 * Logs after today are ignored. Today's INCOMPLETE becomes PENDING.
 */
export function getHistory(state, today) {
  const { startDate } = state.program;
  if (today < startDate) return [];
  const days = dateRange(startDate, today).map((date) => evaluateDay(state, date));
  const last = days[days.length - 1];
  if (last.status === DayStatus.INCOMPLETE) last.status = DayStatus.PENDING;
  return days;
}

export function getProgress(state, today, history = getHistory(state, today)) {
  const { startDate, targetDays } = state.program;
  const started = today >= startDate;

  let completedDays = 0;
  let graduatedOn = null;
  for (const day of history) {
    if (day.status !== DayStatus.COMPLETE) continue;
    completedDays++;
    if (completedDays === targetDays) graduatedOn = day.date;
  }

  return {
    started,
    calendarDay: started ? diffDays(startDate, today) + 1 : 0,
    completedDays,
    targetDays,
    remainingDays: Math.max(0, targetDays - completedDays),
    ratio: Math.min(1, completedDays / targetDays),
    graduated: completedDays >= targetDays,
    graduatedOn,
    today: history.length ? history[history.length - 1] : null,
  };
}
