// Display formatting for UI text (Traditional Chinese).
import { addDays, dayOfWeek, diffDays, parseDateStr } from '../logic/dates.js';

export const WEEKDAY_LABELS = Object.freeze(['日', '一', '二', '三', '四', '五', '六']);

/** "11/16(一)" */
export function shortDate(date) {
  const { month, day } = parseDateStr(date);
  return `${month}/${day}(${WEEKDAY_LABELS[dayOfWeek(date)]})`;
}

/** "今天" / "昨天" / "11/14(六)" */
export function relativeDayLabel(date, today) {
  if (date === today) return '今天';
  if (date === addDays(today, -1)) return '昨天';
  return shortDate(date);
}

export function scheduleLabel(days) {
  const set = [...new Set(days)].sort((a, b) => a - b);
  const key = set.join(',');
  if (key === '0,1,2,3,4,5,6') return '每天';
  if (key === '1,2,3,4,5') return '平日';
  if (key === '0,6') return '週末';
  return `每週${set.map((d) => WEEKDAY_LABELS[d]).join('、')}`;
}

export function daysUntil(today, date) {
  return diffDays(today, date);
}

export function formatNumber(n) {
  return new Intl.NumberFormat('zh-Hant').format(n);
}
