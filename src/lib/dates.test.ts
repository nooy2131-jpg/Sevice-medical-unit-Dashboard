import { describe, expect, it } from 'bun:test';
import { CalendarDateError, assertCalendarDate, dateRange, isCalendarDate, shiftDate, todayBangkok } from './dates';

describe('calendar dates', () => {
  it('rejects impossible dates and accepts leap days', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(isCalendarDate('2025-02-29')).toBe(false);
    expect(isCalendarDate('2025-2-01')).toBe(false);
    expect(isCalendarDate('0001-01-01')).toBe(true);
  });

  it('shifts dates without local timezone drift', () => {
    expect(shiftDate('2025-01-01', -1)).toBe('2024-12-31');
    expect(shiftDate('2024-02-29', 1)).toBe('2024-03-01');
    expect(dateRange('2025-01-07', 7)).toEqual(['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07']);
  });

  it('marks invalid API dates as client errors', () => {
    expect(() => assertCalendarDate('2025-02-30')).toThrow(CalendarDateError);
    try {
      assertCalendarDate('2025-02-30');
    } catch (error) {
      expect((error as CalendarDateError).status).toBe(400);
    }
  });

  it('calculates Bangkok date around UTC midnight', () => {
    expect(todayBangkok(new Date('2025-01-01T17:00:00.000Z'))).toBe('2025-01-02');
  });
});
