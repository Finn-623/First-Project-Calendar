import { dailyRecordService } from './dailyRecordService';
import { historyService } from './historyService';

jest.mock('./historyService', () => ({
  normalizeArchiveTotals: (totals) => ({
    cal: Number(totals?.cal ?? totals?.calories ?? 0),
    p: Number(totals?.p ?? totals?.protein ?? 0),
    f: Number(totals?.f ?? totals?.fat ?? 0),
    c: Number(totals?.c ?? totals?.carbs ?? 0),
  }),
  historyService: { getHistoryDetail: jest.fn() },
}));

describe('dailyRecordService canonical reader', () => {
  beforeEach(() => jest.clearAllMocks());

  test('maps an archived date to the canonical daily record model', async () => {
    historyService.getHistoryDetail.mockResolvedValue({
      timeline: [{ id: 'meal-b', type: 'meal', foods: [{ entryId: 'food-b', cal: 222 }] }],
      nutrition: { calories: 222, protein: 20, fat: 8, carbs: 18 },
      isCompleted: true,
      archiveId: 'archive-b',
      updatedAt: '2026-08-11T14:05:02Z',
      error: null,
    });

    const result = await dailyRecordService.getDailyRecord('user-1', '2026-08-11');

    expect(historyService.getHistoryDetail).toHaveBeenCalledWith('user-1', '2026-08-11');
    expect(result.data).toEqual(expect.objectContaining({
      businessDate: '2026-08-11', status: 'archived', archiveId: 'archive-b', isCompleted: true,
    }));
    expect(result.data.timeline[0].id).toBe('meal-b');
    expect(result.data.foodEntries).toEqual([expect.objectContaining({ entryId: 'food-b', timelineItemId: 'meal-b' })]);
    expect(result.data.totals.cal).toBe(222);
  });

  test('returns a canonical empty record after Supabase reports no archive or live rows', async () => {
    historyService.getHistoryDetail.mockResolvedValue({ timeline: [], nutrition: null, isCompleted: false, error: null });
    const result = await dailyRecordService.getDailyRecord('user-1', '2026-08-10');
    expect(result.data).toEqual(expect.objectContaining({ businessDate: '2026-08-10', status: 'empty', timeline: [] }));
  });
});
