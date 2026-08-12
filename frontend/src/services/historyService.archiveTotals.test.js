import { attachFoodEntriesToTimeline, normalizeArchiveTotals } from './historyService';

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

  test('attaches live food rows to their meal for canonical Home and HistoryDetail display', () => {
    const timeline = attachFoodEntriesToTimeline([{
      id: 'meal-12', item_type: 'breakfast', title: '早餐', event_date: '2026-08-12', event_time: '08:00',
    }], [{
      id: 'entry-12', timeline_item_id: 'meal-12', food_name_snapshot: 'Day C food', quantity: 100,
      calories_snapshot: 333, protein_snapshot: 30, fat_snapshot: 10, carbs_snapshot: 35,
    }]);

    expect(timeline[0]).toEqual(expect.objectContaining({ type: 'meal', subtype: 'breakfast' }));
    expect(timeline[0].foods).toEqual([expect.objectContaining({ entryId: 'entry-12', name: 'Day C food', cal: 333 })]);
  });
});
