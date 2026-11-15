import { describe, it, expect, afterEach } from 'vitest';
import {
  isLeapYear,
  daysInMonth,
  isValidDateStr,
  parseDateStr,
  formatDate,
  addDays,
  diffDays,
  compareDates,
  dateRange,
  dayOfWeek,
  logicalDate,
} from '../src/logic/dates.js';

describe('isLeapYear / daysInMonth', () => {
  it('handles the century rules', () => {
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('returns month lengths', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('isValidDateStr / parseDateStr / formatDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isValidDateStr('2026-11-16')).toBe(true);
    expect(isValidDateStr('2028-02-29')).toBe(true);
    expect(isValidDateStr('2026-02-29')).toBe(false);
    expect(isValidDateStr('2026-04-31')).toBe(false);
    expect(isValidDateStr('2026-13-01')).toBe(false);
    expect(isValidDateStr('2026-00-10')).toBe(false);
    expect(isValidDateStr('2026-1-1')).toBe(false);
    expect(isValidDateStr('20261116')).toBe(false);
    expect(isValidDateStr(null)).toBe(false);
    expect(isValidDateStr(20261116)).toBe(false);
  });

  it('parses and formats symmetrically', () => {
    expect(parseDateStr('2026-03-05')).toEqual({ year: 2026, month: 3, day: 5 });
    expect(formatDate(2026, 3, 5)).toBe('2026-03-05');
    expect(() => parseDateStr('2026-02-30')).toThrow(RangeError);
  });
});

describe('addDays', () => {
  it('crosses month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-04-30', 1)).toBe('2026-05-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('crosses February in leap and non-leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('crosses year ends and long spans', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
    expect(addDays('2028-01-01', 366)).toBe('2029-01-01');
    expect(addDays('2026-11-16', 65)).toBe('2027-01-20');
  });

  it('rejects non-integer offsets and bad dates', () => {
    expect(() => addDays('2026-11-16', 1.5)).toThrow(RangeError);
    expect(() => addDays('2026-11-31', 1)).toThrow(RangeError);
  });
});

describe('diffDays / compareDates', () => {
  it('counts calendar days including leap days', () => {
    expect(diffDays('2026-11-16', '2026-11-16')).toBe(0);
    expect(diffDays('2026-11-16', '2026-11-17')).toBe(1);
    expect(diffDays('2026-11-17', '2026-11-16')).toBe(-1);
    expect(diffDays('2028-02-01', '2028-03-01')).toBe(29);
    expect(diffDays('2026-02-01', '2026-03-01')).toBe(28);
    expect(diffDays('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('orders dates', () => {
    expect(compareDates('2026-11-16', '2026-11-17')).toBe(-1);
    expect(compareDates('2026-12-01', '2026-11-30')).toBe(1);
    expect(compareDates('2026-11-16', '2026-11-16')).toBe(0);
  });
});

describe('dateRange', () => {
  it('is inclusive on both ends', () => {
    expect(dateRange('2028-02-27', '2028-03-01')).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('handles single-day and reversed ranges', () => {
    expect(dateRange('2026-11-16', '2026-11-16')).toEqual(['2026-11-16']);
    expect(dateRange('2026-11-17', '2026-11-16')).toEqual([]);
  });

  it('covers a full 66-day program', () => {
    const range = dateRange('2026-11-16', addDays('2026-11-16', 65));
    expect(range).toHaveLength(66);
    expect(range.at(-1)).toBe('2027-01-20');
  });
});

describe('dayOfWeek', () => {
  it('uses 0 = Sunday', () => {
    expect(dayOfWeek('2026-11-15')).toBe(0); // Sunday
    expect(dayOfWeek('2026-11-16')).toBe(1); // Monday
    expect(dayOfWeek('2026-11-21')).toBe(6); // Saturday
    expect(dayOfWeek('2028-02-29')).toBe(2); // Tuesday
  });
});

describe('logicalDate (day boundary)', () => {
  const local = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi);

  it('treats times before the boundary hour as the previous day', () => {
    expect(logicalDate(local(2026, 11, 16, 3, 59), 4)).toBe('2026-11-15');
    expect(logicalDate(local(2026, 11, 16, 0, 0), 4)).toBe('2026-11-15');
  });

  it('switches day exactly at the boundary hour', () => {
    expect(logicalDate(local(2026, 11, 16, 4, 0), 4)).toBe('2026-11-16');
    expect(logicalDate(local(2026, 11, 16, 23, 59), 4)).toBe('2026-11-16');
  });

  it('uses plain midnight when boundary is 0', () => {
    expect(logicalDate(local(2026, 11, 16, 0, 0), 0)).toBe('2026-11-16');
    expect(logicalDate(local(2026, 11, 15, 23, 59), 0)).toBe('2026-11-15');
  });

  it('crosses month, leap-day and year boundaries', () => {
    expect(logicalDate(local(2026, 3, 1, 2), 4)).toBe('2026-02-28');
    expect(logicalDate(local(2028, 3, 1, 1), 4)).toBe('2028-02-29');
    expect(logicalDate(local(2027, 1, 1, 0, 30), 4)).toBe('2026-12-31');
  });

  it('accepts epoch milliseconds', () => {
    expect(logicalDate(local(2026, 11, 16, 12).getTime(), 4)).toBe('2026-11-16');
  });

  it('rejects invalid input', () => {
    expect(() => logicalDate(local(2026, 11, 16, 12), 24)).toThrow(RangeError);
    expect(() => logicalDate(local(2026, 11, 16, 12), -1)).toThrow(RangeError);
    expect(() => logicalDate(local(2026, 11, 16, 12), 1.5)).toThrow(RangeError);
    expect(() => logicalDate(new Date('nope'), 4)).toThrow(RangeError);
  });

  describe('in a DST time zone', () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    it('is unaffected by the spring-forward gap', () => {
      process.env.TZ = 'America/New_York';
      // 2026-03-08 02:00 jumps to 03:00 in New York.
      expect(logicalDate(new Date(2026, 2, 8, 3, 30), 4)).toBe('2026-03-07');
      expect(logicalDate(new Date(2026, 2, 8, 4, 0), 4)).toBe('2026-03-08');
      expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
      expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
    });
  });
});
