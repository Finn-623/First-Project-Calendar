import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StoreProvider, toDateStr, useStore } from './store';
import { foodService } from './services/foodService';
import { historyService } from './services/historyService';
import { targetService } from './services/targetService';
import { timelineService } from './services/timelineService';

jest.mock('./lib/supabaseClient', () => ({
  supabase: null,
}));

jest.mock('./lib/authState', () => ({
  getCurrentUserId: () => 'user-1',
}));

jest.mock('./services/foodService', () => ({
  foodService: {
    getAllFoods: jest.fn().mockResolvedValue({ data: [], error: null }),
    loadPublicFoods: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

jest.mock('./services/authService', () => ({
  authService: {},
}));

jest.mock('./services/targetService', () => ({
  targetService: {
    getLatestTarget: jest.fn().mockResolvedValue({ data: null, error: null }),
    getTargetHistory: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

jest.mock('./services/timelineService', () => ({
  timelineService: {
    getItemsByDate: jest.fn().mockResolvedValue({ data: [], error: null }),
    getRunningTimelineItems: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

jest.mock('./services/historyService', () => {
  const actualDate = '2026-07-27';
  const addDaysToDateString = (dateStr, days = 1) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + days));
    return next.toISOString().slice(0, 10);
  };

  return {
    getSydneyDateString: (date) => {
      if (!date) return actualDate;
      return date.toISOString().slice(0, 10);
    },
    addDaysToDateString,
    getSydneyMidnightDelayMs: () => 60 * 60 * 1000,
    historyService: {
      getDayCompletion: jest.fn(),
      getHistoryDates: jest.fn().mockResolvedValue({ data: [], error: null }),
      getHistoryDetail: jest.fn(),
      saveDayArchive: jest.fn(),
      deleteFullDayRecords: jest.fn(),
    },
  };
});

const StoreProbe = () => {
  const [route, setRoute] = useState('home');
  const {
    currentDate,
    recordingDateStr,
    timeline,
    history,
    dayInitialized,
    endDay,
    goHome,
    resetDeletedDateState,
    setSelectedDate,
    setTimeline,
  } = useStore();

  const deleteHistoryDate = async (dateStr) => {
    const { error } = await historyService.deleteFullDayRecords(dateStr);
    if (error) return;

    resetDeletedDateState(dateStr);
    setRoute('history');
  };

  return (
    <div>
      <span data-testid="route">{route}</span>
      <span data-testid="current-date">{toDateStr(currentDate)}</span>
      <span data-testid="recording-date">{recordingDateStr}</span>
      <span data-testid="day-initialized">{String(dayInitialized)}</span>
      <span data-testid="timeline-title">{timeline[0]?.title || 'empty'}</span>
      <span data-testid="history-count">{String(history.length)}</span>
      <button type="button" onClick={() => endDay()} data-testid="end-day">结束本日</button>
      <button type="button" onClick={() => goHome()} data-testid="go-home">返回首页</button>
      <button
        type="button"
        onClick={() => {
          setRoute('home');
          goHome();
        }}
        data-testid="nav-home"
      >
        点击首页
      </button>
      <button
        type="button"
        onClick={() => deleteHistoryDate('2026-07-27')}
        data-testid="delete-today-history"
      >
        确认删除本日历史
      </button>
      <button
        type="button"
        onClick={() => deleteHistoryDate('2026-07-20')}
        data-testid="delete-other-history"
      >
        确认删除其他历史
      </button>
      <button type="button" data-testid="cancel-delete">取消删除</button>
      <button
        type="button"
        onClick={() => resetDeletedDateState('2026-07-27')}
        data-testid="reset-today"
      >
        删除真实本日
      </button>
      <button
        type="button"
        onClick={() => resetDeletedDateState('2026-07-20')}
        data-testid="reset-history"
      >
        删除旧历史
      </button>
      <button
        type="button"
        onClick={() => setSelectedDate('2026-07-28')}
        data-testid="select-next"
      >
        查看下一日
      </button>
      <button
        type="button"
        onClick={() => setSelectedDate('2026-07-27')}
        data-testid="select-today"
      >
        返回本日
      </button>
      <button
        type="button"
        onClick={() => setTimeline([{ id: 'stale', type: 'event', title: '旧缓存记录', time: '09:00' }])}
        data-testid="set-stale-timeline"
      >
        写入旧缓存
      </button>
    </div>
  );
};

function renderStore() {
  return render(
    <StoreProvider user={{ id: 'user-1' }}>
      <StoreProbe />
    </StoreProvider>
  );
}

describe('Store 删除日期后的首页状态恢复', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    foodService.getAllFoods.mockResolvedValue({ data: [], error: null });
    foodService.loadPublicFoods.mockResolvedValue({ data: [], error: null });
    targetService.getLatestTarget.mockResolvedValue({ data: null, error: null });
    targetService.getTargetHistory.mockResolvedValue({ data: [], error: null });
    timelineService.getItemsByDate.mockResolvedValue({ data: [], error: null });
    timelineService.getRunningTimelineItems.mockResolvedValue({ data: [], error: null });
    historyService.getDayCompletion.mockResolvedValue({ data: null, error: null });
    historyService.getHistoryDates.mockResolvedValue({ data: [], error: null });
    historyService.getHistoryDetail.mockResolvedValue({
      timeline: [],
      nutrition: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      isEmptyDay: true,
      isCompleted: true,
    });
    historyService.saveDayArchive.mockResolvedValue({ data: null, error: null });
    historyService.deleteFullDayRecords.mockResolvedValue({ data: null, error: null });
  });

  test('关键路径：结束真实本日后生成历史并保持下一记录日首页规则', async () => {
    historyService.getHistoryDates.mockResolvedValue({ data: ['2026-07-27'], error: null });

    renderStore();

    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
    });

    fireEvent.click(screen.getByTestId('end-day'));

    await waitFor(() => {
      expect(historyService.saveDayArchive).toHaveBeenCalledWith(
        'user-1',
        '2026-07-27',
        expect.any(Array),
        expect.objectContaining({ cal: expect.any(Number) }),
      );
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('history-count').textContent).toBe('1');
    });

    historyService.getDayCompletion.mockResolvedValue({
      data: { is_completed: true },
      error: null,
    });
    fireEvent.click(screen.getByTestId('nav-home'));

    await waitFor(() => {
      expect(screen.getByTestId('route').textContent).toBe('home');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
    });
  });

  test('关键路径：删除真实本日历史后停留历史页，再回首页恢复真实本日', async () => {
    historyService.getDayCompletion.mockResolvedValue({
      data: { is_completed: true },
      error: null,
    });
    historyService.getHistoryDates.mockResolvedValue({ data: ['2026-07-27'], error: null });

    renderStore();

    await waitFor(() => {
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('history-count').textContent).toBe('1');
    });

    fireEvent.click(screen.getByTestId('delete-today-history'));

    await waitFor(() => {
      expect(historyService.deleteFullDayRecords).toHaveBeenCalledWith('2026-07-27');
      expect(screen.getByTestId('route').textContent).toBe('history');
      expect(screen.getByTestId('history-count').textContent).toBe('0');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
    });

    historyService.getDayCompletion.mockResolvedValue({ data: null, error: null });
    fireEvent.click(screen.getByTestId('nav-home'));

    await waitFor(() => {
      expect(screen.getByTestId('route').textContent).toBe('home');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
    });
  });

  test('关键路径：删除其他日期不改变真实本日完成状态或当前记录日', async () => {
    historyService.getDayCompletion.mockResolvedValue({
      data: { is_completed: true },
      error: null,
    });

    renderStore();
    await waitFor(() => {
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
    });

    fireEvent.click(screen.getByTestId('delete-other-history'));

    await waitFor(() => {
      expect(historyService.deleteFullDayRecords).toHaveBeenCalledWith('2026-07-20');
      expect(screen.getByTestId('route').textContent).toBe('history');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
    });

    fireEvent.click(screen.getByTestId('nav-home'));
    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
    });
  });

  test('关键路径：取消或删除失败均不提前重置日期状态', async () => {
    historyService.getDayCompletion.mockResolvedValue({
      data: { is_completed: true },
      error: null,
    });

    renderStore();
    await waitFor(() => {
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
    });

    fireEvent.click(screen.getByTestId('cancel-delete'));
    expect(historyService.deleteFullDayRecords).not.toHaveBeenCalled();
    expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
    expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');

    historyService.deleteFullDayRecords.mockResolvedValue({
      data: null,
      error: new Error('删除失败'),
    });
    fireEvent.click(screen.getByTestId('delete-today-history'));

    await waitFor(() => {
      expect(historyService.deleteFullDayRecords).toHaveBeenCalledWith('2026-07-27');
    });
    expect(screen.getByTestId('route').textContent).toBe('home');
    expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
    expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
  });

  test('关键路径：刷新初始化按完成状态恢复，删除本日后重新初始化恢复真实本日', async () => {
    historyService.getDayCompletion.mockResolvedValue({
      data: { is_completed: true },
      error: null,
    });

    const firstMount = renderStore();
    await waitFor(() => {
      expect(screen.getByTestId('day-initialized').textContent).toBe('true');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
    });
    firstMount.unmount();

    historyService.getDayCompletion.mockResolvedValue({ data: null, error: null });
    renderStore();
    await waitFor(() => {
      expect(screen.getByTestId('day-initialized').textContent).toBe('true');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
    });
  });

  test('结束本日推进到下一日后，删除真实本日会恢复真实本日和空白时间线', async () => {
    renderStore();

    await waitFor(() => {
      expect(screen.getByTestId('day-initialized').textContent).toBe('true');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
    });

    fireEvent.click(screen.getByTestId('end-day'));
    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
    });

    fireEvent.click(screen.getByTestId('reset-today'));

    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('timeline-title').textContent).toBe('早餐');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('go-home'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
    });
  });

  test('本日未结束时点击首页保持真实本日', async () => {
    historyService.getDayCompletion.mockResolvedValueOnce({ data: null, error: null });

    renderStore();

    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('go-home'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
    });
  });

  test('本日已结束且历史存在时点击首页保持下一日', async () => {
    historyService.getDayCompletion.mockResolvedValue({ data: { is_completed: true }, error: null });

    renderStore();

    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('go-home'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
    });
  });

  test('删除真实本日会清除旧日期缓存和可能残留的持久化日期键', async () => {
    localStorage.setItem('persist:recordingDateStr', '2026-07-28');
    localStorage.setItem('zustand-date-store', '{"viewingDate":"2026-07-27"}');
    localStorage.setItem('recordSettings_savedTimezone', JSON.stringify('Australia/Sydney'));

    renderStore();
    await screen.findByText('true');

    fireEvent.click(screen.getByTestId('end-day'));
    await waitFor(() => {
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
    });

    fireEvent.click(screen.getByTestId('reset-today'));

    await waitFor(() => {
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
    });

    expect(localStorage.getItem('persist:recordingDateStr')).toBeNull();
    expect(localStorage.getItem('zustand-date-store')).toBeNull();
    // 非日期状态键不应被误删
    expect(localStorage.getItem('recordSettings_savedTimezone')).toBe(JSON.stringify('Australia/Sydney'));
  });

  test('删除其他历史日期不会改变已推进的首页日期状态', async () => {
    historyService.getDayCompletion.mockResolvedValue({ data: { is_completed: true }, error: null });

    renderStore();
    await screen.findByText('true');

    fireEvent.click(screen.getByTestId('end-day'));
    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
    });

    fireEvent.click(screen.getByTestId('reset-history'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('go-home'));
    });

    expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
    expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
  });

  test('删除真实本日会清除旧时间线缓存，之后进入首页不会恢复旧记录', async () => {
    renderStore();
    await screen.findByText('true');

    fireEvent.click(screen.getByTestId('set-stale-timeline'));
    await waitFor(() => {
      expect(screen.getByTestId('timeline-title').textContent).toBe('旧缓存记录');
    });

    fireEvent.click(screen.getByTestId('select-next'));
    fireEvent.click(screen.getByTestId('reset-today'));
    fireEvent.click(screen.getByTestId('select-next'));
    fireEvent.click(screen.getByTestId('select-today'));

    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('timeline-title').textContent).toBe('早餐');
    });
  });

  test('删除前开始的旧初始化结果不会覆盖恢复后的真实本日', async () => {
    let resolveCompletion;
    historyService.getDayCompletion.mockReturnValueOnce(new Promise((resolve) => {
      resolveCompletion = resolve;
    }));

    renderStore();
    fireEvent.click(screen.getByTestId('reset-today'));

    await act(async () => {
      resolveCompletion({
        data: { is_completed: true },
        error: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
    });
  });

  test('删除真实本日后即使重新挂载，也不会恢复到旧的下一日', async () => {
    const { unmount } = renderStore();

    await waitFor(() => {
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
    });

    fireEvent.click(screen.getByTestId('end-day'));
    await waitFor(() => {
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
    });

    fireEvent.click(screen.getByTestId('reset-today'));
    await waitFor(() => {
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('go-home'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
    });

    unmount();
    renderStore();

    await waitFor(() => {
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-27');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-27');
    });
  });
});
