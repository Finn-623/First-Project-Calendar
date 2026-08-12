import {
  addDaysToDateString,
  createDisplayDateFromBusinessDate,
  formatBusinessDateLabel,
  getSydneyDateString,
  isBusinessDateKey,
} from './businessDate';

describe('Sydney business date contract', () => {
  test('uses Sydney calendar dates across the UTC day boundary', () => {
    expect(getSydneyDateString(new Date('2026-08-11T13:30:00.000Z'))).toBe('2026-08-11');
    expect(getSydneyDateString(new Date('2026-08-11T14:30:00.000Z'))).toBe('2026-08-12');
    expect(getSydneyDateString(new Date('2026-12-31T12:30:00.000Z'))).toBe('2026-12-31');
    expect(getSydneyDateString(new Date('2026-12-31T13:30:00.000Z'))).toBe('2027-01-01');
  });

  test('advances business date keys without converting them through local time', () => {
    expect(addDaysToDateString('2026-08-11', 1)).toBe('2026-08-12');
    expect(addDaysToDateString('2026-08-11', -1)).toBe('2026-08-10');
    expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01');
  });

  test('keeps date-only labels and display dates on the requested calendar day', () => {
    const display = createDisplayDateFromBusinessDate('2026-08-11');
    expect(display.getFullYear()).toBe(2026);
    expect(display.getMonth()).toBe(7);
    expect(display.getDate()).toBe(11);
    expect(formatBusinessDateLabel('2026-08-11')).toBe('8月11日 · 周二');
    expect(formatBusinessDateLabel('2026-08-11', { includeYear: true })).toBe('2026年8月11日');
  });

  test('rejects malformed or impossible business dates', () => {
    expect(isBusinessDateKey('2026-02-29')).toBe(false);
    expect(isBusinessDateKey('2026-8-11')).toBe(false);
    expect(addDaysToDateString('not-a-date', 1)).toBe('');
  });
});
