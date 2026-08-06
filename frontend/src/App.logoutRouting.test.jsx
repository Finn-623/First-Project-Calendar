import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { supabase } from './lib/supabaseClient';
import { registerAuthListener } from './lib/authState';

let mockProfileByUser;
const mockNavigate = jest.fn();

jest.mock('@/App.css', () => ({}), { virtual: true });

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ path, element }) => <div data-testid={`route-${path}`}>{element}</div>,
  Navigate: ({ to }) => <div data-testid={`redirect-${to}`}>redirect:{to}</div>,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/settings' }),
}), { virtual: true });

jest.mock('./lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: jest.fn(),
  },
}));

jest.mock('./lib/authState', () => ({
  registerAuthListener: jest.fn(),
  unregisterAuthListener: jest.fn(),
}));

jest.mock('./store', () => ({
  StoreProvider: ({ user, profile, children }) => (
    <div>
      <span data-testid="store-user">{user?.id || 'null'}</span>
      <span data-testid="store-profile">{profile?.display_name || 'null'}</span>
      {children}
    </div>
  ),
}));

jest.mock('./components/BottomNav', () => ({ BottomNav: () => <div>底部导航</div> }));
jest.mock('./pages/TodayPage', () => ({ TodayPage: () => <div>受保护首页</div> }));
jest.mock('./pages/HistoryPage', () => ({ HistoryPage: () => <div>历史</div> }));
jest.mock('./pages/HistoryDetailPage', () => ({ HistoryDetailPage: () => <div>历史详情</div> }));
jest.mock('./pages/FoodLibraryPage', () => ({ FoodLibraryPage: () => <div>食物库</div> }));
jest.mock('./pages/PublicFoodReviewPage', () => ({ PublicFoodReviewPage: () => <div>公共食品审核</div> }));
jest.mock('./pages/PlanPage', () => ({ PlanPage: () => <div>计划</div> }));
jest.mock('./pages/SettingsPage', () => ({ SettingsPage: () => <div>设置</div> }));
jest.mock('./pages/AccountInfoPage', () => ({ AccountInfoPage: () => <div>账户</div> }));
jest.mock('./pages/ProfileInfoPage', () => ({ ProfileInfoPage: () => <div>个人信息</div> }));
jest.mock('./pages/SettingsVersionPage', () => ({ SettingsVersionPage: () => <div>版本</div> }));
jest.mock('./pages/VersionFeedbackPage', () => ({ VersionFeedbackPage: () => <div>反馈</div> }));
jest.mock('./pages/SettingsIntakePlanPage', () => ({ SettingsIntakePlanPage: () => <div>摄入计划</div> }));
jest.mock('./pages/SettingsRecordSettingsPage', () => ({ SettingsRecordSettingsPage: () => <div>记录设置</div> }));
jest.mock('./pages/LoginPage', () => ({ LoginPage: () => <div data-testid="ordinary-login-page">普通登录页</div> }));
jest.mock('sonner', () => ({ Toaster: () => null }));

describe('App 退出后的受保护路由', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    mockProfileByUser = new Map();
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabase.from.mockImplementation((table) => ({
      select: () => ({
        eq: (_column, userId) => ({
          maybeSingle: () => {
            if (table !== 'profiles') {
              return Promise.resolve({ data: null, error: null });
            }
            const value = mockProfileByUser.get(userId);
            return Promise.resolve(value || { data: null, error: null });
          },
        }),
      }),
    }));
  });

  test('无会话访问受保护页面时返回普通登录页', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('redirect-/login')).toBeTruthy();
    });
    expect(screen.getByTestId('route-/login')).toBeTruthy();
    expect(screen.getByTestId('ordinary-login-page')).toBeTruthy();
    expect(screen.queryByText('受保护首页')).toBeNull();
  });

  test('有效 session 刷新时先保持认证加载，再显示受保护页面', async () => {
    let resolveSession;
    supabase.auth.getSession.mockReturnValue(new Promise((resolve) => {
      resolveSession = resolve;
    }));
    mockProfileByUser.set('user-a', {
      data: { id: 'user-a', display_name: '账号 A', role: 'admin' },
      error: null,
    });

    render(<App />);

    expect(screen.getByText('正在检查登录状态...')).toBeTruthy();
    expect(screen.queryByTestId('ordinary-login-page')).toBeNull();
    expect(screen.queryByText('受保护首页')).toBeNull();

    resolveSession({
      data: {
        session: {
          access_token: 'session-a',
          user: { id: 'user-a' },
        },
      },
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByText('受保护首页')).toBeTruthy();
      expect(screen.getByTestId('store-user').textContent).toBe('user-a');
      expect(screen.getByTestId('store-profile').textContent).toBe('账号 A');
    });
    expect(screen.queryByTestId('ordinary-login-page')).toBeNull();
  });

  test('有效session确认后不等待profile远程请求即可挂载用户Store', async () => {
    let resolveProfile;
    mockProfileByUser.set('user-a', new Promise((resolve) => {
      resolveProfile = resolve;
    }));
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'session-a', user: { id: 'user-a' } } },
      error: null,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('受保护首页')).toBeTruthy();
      expect(screen.getByTestId('store-user').textContent).toBe('user-a');
      expect(screen.getByTestId('store-profile').textContent).toBe('null');
    });

    resolveProfile({ data: { id: 'user-a', display_name: '账号 A', role: 'user' }, error: null });
    await waitFor(() => expect(screen.getByTestId('store-profile').textContent).toBe('账号 A'));
  });

  test('session 恢复失败时结束 loading 并返回普通登录页', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error('session 恢复失败'),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('ordinary-login-page')).toBeTruthy();
      expect(screen.getByTestId('redirect-/login')).toBeTruthy();
    });
    expect(screen.queryByText('认证出错')).toBeNull();
    expect(screen.queryByText('受保护首页')).toBeNull();
  });

  test('账号变化时先清空旧 profile，迟到前不显示上一账号资料', async () => {
    let resolveProfileB;
    mockProfileByUser.set('user-a', {
      data: { id: 'user-a', display_name: '账号 A', role: 'admin' },
      error: null,
    });
    mockProfileByUser.set('user-b', new Promise((resolve) => {
      resolveProfileB = resolve;
    }));
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-a',
          user: { id: 'user-a' },
        },
      },
      error: null,
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('store-profile').textContent).toBe('账号 A');
    });

    const authCallback = registerAuthListener.mock.calls[0][0];
    act(() => {
      authCallback('SIGNED_IN', {
        access_token: 'session-b',
        user: { id: 'user-b' },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('store-user').textContent).toBe('user-b');
      expect(screen.getByTestId('store-profile').textContent).toBe('null');
    });

    resolveProfileB({
      data: { id: 'user-b', display_name: '账号 B', role: 'admin' },
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId('store-profile').textContent).toBe('账号 B');
    });
  });

  test('相同 session 的重复认证回调不重复加载 profile', async () => {
    mockProfileByUser.set('user-a', {
      data: { id: 'user-a', display_name: '账号 A', role: 'admin' },
      error: null,
    });
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-a',
          user: { id: 'user-a' },
        },
      },
      error: null,
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('store-profile').textContent).toBe('账号 A');
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);

    const authCallback = registerAuthListener.mock.calls[0][0];
    act(() => {
      authCallback('INITIAL_SESSION', {
        access_token: 'session-a',
        user: { id: 'user-a' },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('store-user').textContent).toBe('user-a');
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  test('新应用会话首次进入首页，并在同一会话刷新时保留当前路由', async () => {
    mockProfileByUser.set('user-a', {
      data: { id: 'user-a', display_name: '账号 A', role: 'user' },
      error: null,
    });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'session-a', user: { id: 'user-a' } } },
      error: null,
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('受保护首页')).toBeTruthy());
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });

    mockNavigate.mockClear();
    render(<App />);
    await waitFor(() => expect(screen.getByText('受保护首页')).toBeTruthy());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
