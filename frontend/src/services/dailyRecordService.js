import { historyService, normalizeArchiveTotals } from './historyService';

const EMPTY_TOTALS = Object.freeze({ cal: 0, p: 0, f: 0, c: 0 });

export const createEmptyDailyRecord = (businessDate) => ({
  businessDate,
  status: 'empty',
  timeline: [],
  meals: [],
  foodEntries: [],
  totals: { ...EMPTY_TOTALS },
  archiveId: null,
  updatedAt: null,
  isCompleted: false,
  isEmptyDay: true,
});

const flattenFoods = (timeline) => timeline.flatMap((item) => (
  (item?.foods || []).map((food) => ({ ...food, timelineItemId: item.id }))
));

/**
 * Canonical, Supabase-first daily record reader used by Home, History and
 * HistoryDetail. historyService owns the archive-first/live-second database
 * query; this adapter guarantees one UI model for either storage shape.
 */
export const dailyRecordService = {
  async getDailyRecord(userId, businessDate) {
    if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(String(businessDate || ''))) {
      return { data: createEmptyDailyRecord(businessDate), error: new Error('无效的用户或业务日期') };
    }

    const detail = await historyService.getHistoryDetail(userId, businessDate);
    if (detail?.error) return { data: null, error: detail.error };

    const timeline = Array.isArray(detail?.timeline) ? detail.timeline : [];
    const isCompleted = detail?.isCompleted === true;
    const hasData = timeline.length > 0 || isCompleted;
    const data = hasData ? {
      businessDate,
      status: isCompleted ? 'archived' : 'live',
      timeline,
      meals: timeline.filter((item) => item?.type === 'meal'),
      foodEntries: flattenFoods(timeline),
      totals: normalizeArchiveTotals(detail?.nutrition, timeline),
      archiveId: detail?.archiveId || null,
      updatedAt: detail?.updatedAt || null,
      isCompleted,
      isEmptyDay: detail?.isEmptyDay === true,
      dateLabel: detail?.dateLabel || null,
    } : createEmptyDailyRecord(businessDate);

    return { data, error: null };
  },
};
