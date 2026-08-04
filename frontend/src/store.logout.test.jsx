import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StoreProvider, toDateStr, useStore } from './store';
import { supabase } from './lib/supabaseClient';
import { foodService } from './services/foodService';
import { historyService } from './services/historyService';
import { targetService } from './services/targetService';
import { timelineService } from './services/timelineService';

jest.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock('./lib/authState', () => ({
  getCurrentUserId: () => null,
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
      <span data-testid="history-dates">{store.history.map((item) => item.dateStr).join(',')}</span>
      <span data-testid="foods">{store.foods.map((item) => item.name).join(',')}</span>
      <span data-testid="my-foods">{store.myFoods.map((item) => item.name).join(',')}</span>
      <span data-testid="my-foods-status">{store.myFoodsStatus}</span>
      <span data-testid="my-foods-user">{store.myFoodsUserId || 'null'}</span>
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
      <button
        type="button"
        onClick={() => store.updateAuthState(
          { id: 'user-1' },
          { access_token: 'session-a-new' },
          { display_name: '账号 A 新会话' },
        )}
      >
        登录账号 A
      </button>
      <button
        type="button"
        onClick={() => store.updateAuthState(
          { id: 'user-2' },
          { access_token: 'session-b' },
          { display_name: '账号 B' },
        )}
      >
        登录账号 B
      </button>
      <button type="button" onClick={() => store.loadHistory('user-1')}>启动账号 A 旧请求</button>
    </div>
  );
};

describe('Store 退出账号清理', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    supabase.auth.signOut.mockResolvedValue({ error: null });
    supabase.from.mockImplementation((table) => ({
      select: () => ({
        eq: (_column, userId) => ({
          maybeSingle: () => Promise.resolve({
            data: table === 'profiles'
              ? { id: userId, display_name: userId === 'user-2' ? '账号 B' : '账号 A', role: 'user' }
              : null,
            error: null,
          }),
        }),
      }),
    }));
    foodService.getAllFoods.mockResolvedValue({ data: [], error: null });
    foodService.loadPublicFoods.mockResolvedValue({ data: [], error: null });
    targetService.getLatestTarget.mockResolvedValue({ data: null, error: null });
    targetService.getTargetHistory.mockResolvedValue({ data: [], error: null });
    timelineService.getRunningTimelineItems.mockResolvedValue({ data: [], error: null });
    historyService.getDayCompletion.mockResolvedValue({ data: null, error: null });
    historyService.getHistoryDates.mockResolvedValue({ data: [], error: null });
    historyService.getHistoryDetail.mockResolvedValue({
      timeline: [],
      nutrition: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      isCompleted: false,
    });
  });

  test('退出成功后清除私有用户状态并保留公共食品配置', async () => {
    foodService.getAllFoods.mockResolvedValue({
      data: [{ id: 'public-food', name: '公共食物', visibility: 'public' }],
      error: null,
    });
    foodService.loadPublicFoods.mockResolvedValue({
      data: [{ id: 'public-food', name: '公共食物', visibility: 'public' }],
      error: null,
    });

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

  test('同一账号重新登录后重新加载该账号数据和日期状态', async () => {
    render(
      <StoreProvider
        user={{ id: 'user-1' }}
        session={{ access_token: 'session-a' }}
        profile={{ display_name: '账号 A' }}
      >
        <StoreProbe />
      </StoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('day-initialized').textContent).toBe('true');
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '退出账号' }));
    });

    historyService.getDayCompletion.mockResolvedValue({
      data: { is_completed: true },
      error: null,
    });
    historyService.getHistoryDates.mockResolvedValue({ data: ['2026-07-28'], error: null });
    targetService.getLatestTarget.mockResolvedValue({
      data: {
        target_date: '2026-07-29',
        calories_target: 1900,
        protein_target: 120,
        fat_target: 60,
        carbs_target: 200,
      },
      error: null,
    });
    foodService.getAllFoods.mockResolvedValue({
      data: [
        { id: 'a-private', user_id: 'user-1', name: '账号 A 食物', visibility: 'private' },
        { id: 'public', name: '公共食物', visibility: 'public' },
      ],
      error: null,
    });

    fireEvent.click(screen.getByRole('button', { name: '登录账号 A' }));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('user-1');
      expect(screen.getByTestId('current-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('recording-date').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('foods').textContent).toContain('账号 A 食物');
      expect(screen.getByTestId('my-foods').textContent).toContain('账号 A 食物');
      expect(screen.getByTestId('my-foods-status').textContent).toBe('success');
      expect(screen.getByTestId('my-foods-user').textContent).toBe('user-1');
      expect(screen.getByTestId('history-dates').textContent).toBe('2026-07-28');
      expect(screen.getByTestId('plan').textContent).toBe('1900');
    });
  });

  test('匿名阶段保持 idle，userId 变为真实值后才加载个人食品', async () => {
    foodService.getAllFoods.mockResolvedValue({
      data: [{ id: 'user-1-food', user_id: 'user-1', name: '登录后食品', visibility: 'private', is_active: true }],
      error: null,
    });
    render(<StoreProvider><StoreProbe /></StoreProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('my-foods-status').textContent).toBe('idle');
      expect(screen.getByTestId('my-foods-user').textContent).toBe('null');
    });
    fireEvent.click(screen.getByRole('button', { name: '登录账号 A' }));
    await waitFor(() => {
      expect(screen.getByTestId('my-foods').textContent).toContain('登录后食品');
      expect(screen.getByTestId('my-foods-status').textContent).toBe('success');
      expect(screen.getByTestId('my-foods-user').textContent).toBe('user-1');
    });
  });

  test('不同账号登录时忽略账号 A 迟到响应并只显示账号 B 数据', async () => {
    let resolveOldHistory;
    render(
      <StoreProvider
        user={{ id: 'user-1' }}
        session={{ access_token: 'session-a' }}
        profile={{ display_name: '账号 A' }}
      >
        <StoreProbe />
      </StoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('day-initialized').textContent).toBe('true');
    });

    historyService.getHistoryDates.mockImplementation((userId) => {
      if (userId === 'user-1') {
        return new Promise((resolve) => {
          resolveOldHistory = resolve;
        });
      }
      return Promise.resolve({ data: ['2026-07-29'], error: null });
    });
    historyService.getHistoryDetail.mockImplementation((userId, dateStr) => Promise.resolve({
      dateLabel: dateStr,
      timeline: [{ id: `${userId}-timeline`, title: `${userId}记录`, type: 'event' }],
      nutrition: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      isCompleted: false,
    }));
    targetService.getLatestTarget.mockImplementation((userId) => Promise.resolve({
      data: {
        target_date: '2026-07-29',
        calories_target: userId === 'user-2' ? 1800 : 2200,
        protein_target: 100,
        fat_target: 50,
        carbs_target: 180,
      },
      error: null,
    }));
    foodService.getAllFoods.mockImplementation((userId) => Promise.resolve({
      data: [
        { id: `${userId}-private`, user_id: userId, name: `${userId}私有食物`, visibility: 'private' },
        { id: 'public', name: '公共食物', visibility: 'public' },
      ],
      error: null,
    }));

    fireEvent.click(screen.getByRole('button', { name: '启动账号 A 旧请求' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '退出账号' }));
    });
    fireEvent.click(screen.getByRole('button', { name: '登录账号 B' }));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('user-2');
      expect(screen.getByTestId('foods').textContent).toContain('user-2私有食物');
      expect(screen.getByTestId('foods').textContent).not.toContain('user-1私有食物');
      expect(screen.getByTestId('my-foods').textContent).toContain('user-2私有食物');
      expect(screen.getByTestId('my-foods').textContent).not.toContain('user-1私有食物');
      expect(screen.getByTestId('my-foods-user').textContent).toBe('user-2');
      expect(screen.getByTestId('public-foods').textContent).toContain('公共食物');
      expect(screen.getByTestId('history-dates').textContent).toBe('2026-07-29');
      expect(screen.getByTestId('plan').textContent).toBe('1800');
      expect(screen.getByTestId('timeline').textContent).not.toContain('上个账号记录');
    });

    await act(async () => {
      resolveOldHistory({ data: ['2026-07-20'], error: null });
    });

    await waitFor(() => {
      expect(screen.getByTestId('history-dates').textContent).toBe('2026-07-29');
      expect(screen.getByTestId('profile').textContent).not.toBe('账号 A');
    });
  });
});
