// Date helpers. All app dates are local-calendar strings in YYYY-MM-DD form.
// Arithmetic is done on UTC timestamps of the calendar date so DST never shifts a day.
// Pure module: no DOM, no storage, no implicit "now".

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year, month) {
  // month is 1-12; day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidDateStr(value) {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function parseDateStr(value) {
  if (!isValidDateStr(value)) throw new RangeError(`Invalid date string: ${value}`);
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

export function formatDate(year, month, day) {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toUtcMs(value) {
  const { year, month, day } = parseDateStr(value);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms) {
  const dt = new Date(ms);
  return formatDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(value, days) {
  if (!Number.isInteger(days)) throw new RangeError(`days must be an integer: ${days}`);
  return fromUtcMs(toUtcMs(value) + days * DAY_MS);
}

/** Number of days from `from` to `to` (positive when `to` is later). */
export function diffDays(from, to) {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function compareDates(a, b) {
  // Valid YYYY-MM-DD strings sort lexicographically in calendar order.
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Inclusive list of dates from start to end; empty if end is before start. */
export function dateRange(start, end) {
  const count = diffDays(start, end) + 1;
  const out = [];
  for (let i = 0; i < count; i++) out.push(addDays(start, i));
  return out;
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(value) {
  return new Date(toUtcMs(value)).getUTCDay();
}

/**
 * The app's logical "today" for a given instant, in the device's local time zone.
 * Before `boundaryHour` (0-23) the instant still belongs to the previous calendar day.
 * @param {Date|number} now
 * @param {number} boundaryHour
 */
export function logicalDate(now, boundaryHour = 0) {
  if (!Number.isInteger(boundaryHour) || boundaryHour < 0 || boundaryHour > 23) {
    throw new RangeError(`boundaryHour must be an integer 0-23: ${boundaryHour}`);
  }
  const dt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(dt.getTime())) throw new RangeError('Invalid instant');
  const calendar = formatDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  return dt.getHours() < boundaryHour ? addDays(calendar, -1) : calendar;
}
