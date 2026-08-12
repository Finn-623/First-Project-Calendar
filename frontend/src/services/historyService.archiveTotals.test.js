import { normalizeArchiveTotals } from './historyService';

jest.mock('../lib/supabaseClient', () => ({ supabase: {} }));

describe('history archive totals compatibility', () => {
  test('normalizes manual archive short keys', () => {
    expect(normalizeArchiveTotals({ cal: 101, p: 10, f: 5, c: 20 })).toEqual({ cal: 101, p: 10, f: 5, c: 20 });
  });

  test('normalizes automatic archive long keys for History consumption display', () => {
    expect(normalizeArchiveTotals({ calories: 202, protein: 20, fat: 10, carbs: 40 })).toEqual({ cal: 202, p: 20, f: 10, c: 40 });
  });

  test('keeps zero live-day totals numeric instead of undefined', () => {
    expect(normalizeArchiveTotals({ calories: 0, protein: 0, fat: 0, carbs: 0 })).toEqual({ cal: 0, p: 0, f: 0, c: 0 });
  });
});
