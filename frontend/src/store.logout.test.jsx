import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StoreProvider, toDateStr, useStore } from './store';
import { supabase } from './lib/supabaseClient';
import { foodService } from './services/foodService';

jest.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
    },
  },
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

jest.mock('./services/historyService', () => ({
  getSydneyDateString: () => '2026-07-28',
  addDaysToDateString: (value) => value,
  getSydneyMidnightDelayMs: () => 60 * 60 * 1000,
  historyService: {
    getDayCompletion: jest.fn().mockResolvedValue({ data: null, error: null }),
    getHistoryDates: jest.fn().mockResolvedValue({ data: [], error: null }),
    getHistoryDetail: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

const StoreProbe = () => {
  const store = useStore();

  return (
    <div>
      <span data-testid="user">{store.user?.id || 'null'}</span>
      <span data-testid="session">{store.session?.access_token || 'null'}</span>
      <span data-testid="profile">{store.profile?.display_name || 'null'}</span>
      <span data-testid="timeline">{store.timeline.map((item) => item.title).join(',')}</span>
      <span data-testid="history">{store.history.length}</span>
      <span data-testid="foods">{store.foods.map((item) => item.name).join(',')}</span>
      <span data-testid="public-foods">{store.publicFoods.map((item) => item.name).join(',')}</span>
      <span data-testid="plan">{store.plan?.calories || 'null'}</span>
      <span data-testid="plan-history">{store.planHistory.length}</span>
      <span data-testid="current-date">{toDateStr(store.currentDate)}</span>
      <span data-testid="recording-date">{store.recordingDateStr}</span>
      <span data-testid="day-initialized">{String(store.dayInitialized)}</span>
      <span data-testid="auth-error">{store.authError || 'null'}</span>
      <button
        type="button"
        onClick={() => {
          store.setTimeline([{ id: 'private-timeline', title: '上个账号记录', type: 'event' }]);
          store.setHistory([{ dateStr: '2026-07-27' }]);
          store.setFoods([
            { id: 'private-food', name: '私人食物', visibility: 'private' },
            { id: 'public-food', name: '公共食物', visibility: 'public' },
          ]);
          store.setPublicFoods([{ id: 'public-food', name: '公共食物', visibility: 'public' }]);
          store.setPlan({ calories: 2000 });
          store.setPlanHistory([{ id: 'plan-history' }]);
          store.setSelectedDate('2026-07-30');
        }}
      >
        写入用户状态
      </button>
      <button type="button" onClick={() => store.logout()}>退出账号</button>
    </div>
  );
};

describe('Store 退出账号清理', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    supabase.auth.signOut.mockResolvedValue({ error: null });
    foodService.getAllFoods.mockResolvedValue({ data: [], error: null });
    foodService.loadPublicFoods.mockResolvedValue({ data: [], error: null });
  });

  test('退出成功后清除私有用户状态并保留公共食品配置', async () => {
    render(
      <StoreProvider
        user={{ id: 'user-1' }}
        session={{ access_token: 'session-1' }}
        profile={{ display_name: '上个账号' }}
      >
        <StoreProbe />
      </StoreProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '写入用户状态' }));
    await waitFor(() => {
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-30');
      expect(screen.getByTestId('foods').textContent).toContain('私人食物');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '退出账号' }));
    });

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('user').textContent).toBe('null');
      expect(screen.getByTestId('session').textContent).toBe('null');
      expect(screen.getByTestId('profile').textContent).toBe('null');
      expect(screen.getByTestId('history').textContent).toBe('0');
      expect(screen.getByTestId('foods').textContent).toBe('公共食物');
      expect(screen.getByTestId('public-foods').textContent).toBe('公共食物');
      expect(screen.getByTestId('plan').textContent).toBe('null');
      expect(screen.getByTestId('plan-history').textContent).toBe('0');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('day-initialized').textContent).toBe('false');
      expect(screen.getByTestId('auth-error').textContent).toBe('null');
      expect(screen.getByTestId('timeline').textContent).not.toContain('上个账号记录');
    });
  });
});
