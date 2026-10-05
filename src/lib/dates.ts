const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class CalendarDateError extends Error {
  readonly status = 400;
  readonly code = 'INVALID_DATE';

  constructor() {
    super('reportDate must be a valid YYYY-MM-DD calendar date');
    this.name = 'CalendarDateError';
  }
}

/** Return true only for a real proleptic Gregorian calendar date. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

export function assertCalendarDate(value: unknown): asserts value is string {
  if (!isCalendarDate(value)) throw new CalendarDateError();
}

/** Current date in Asia/Bangkok, independent of the server's local timezone. */
export function todayBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Shift a calendar date by whole days without applying a local timezone. */
export function shiftDate(date: string, days: number): string {
  assertCalendarDate(date);
  if (!Number.isInteger(days)) throw new Error('days must be an integer');
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(0);
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCFullYear(year, month - 1, day);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function dateRange(endDate: string, days: number): string[] {
  assertCalendarDate(endDate);
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('days must be an integer from 1 to 366');
  return Array.from({ length: days }, (_, index) => shiftDate(endDate, index - days + 1));
}
