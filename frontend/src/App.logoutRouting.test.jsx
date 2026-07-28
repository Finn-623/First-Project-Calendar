import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { supabase } from './lib/supabaseClient';

jest.mock('@/App.css', () => ({}), { virtual: true });

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ path, element }) => <div data-testid={`route-${path}`}>{element}</div>,
  Navigate: ({ to }) => <div data-testid={`redirect-${to}`}>redirect:{to}</div>,
  useLocation: () => ({ pathname: '/settings' }),
}), { virtual: true });

jest.mock('./lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

jest.mock('./lib/authState', () => ({
  registerAuthListener: jest.fn(),
  unregisterAuthListener: jest.fn(),
}));

jest.mock('./components/BottomNav', () => ({ BottomNav: () => <div>底部导航</div> }));
jest.mock('./pages/TodayPage', () => ({ TodayPage: () => <div>受保护首页</div> }));
jest.mock('./pages/HistoryPage', () => ({ HistoryPage: () => <div>历史</div> }));
jest.mock('./pages/HistoryDetailPage', () => ({ HistoryDetailPage: () => <div>历史详情</div> }));
jest.mock('./pages/FoodLibraryPage', () => ({ FoodLibraryPage: () => <div>食物库</div> }));
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
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
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
});
