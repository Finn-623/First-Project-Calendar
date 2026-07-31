import React, { useEffect, useState, useRef, useCallback } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { BottomNav } from './components/BottomNav';
import { TodayPage } from './pages/TodayPage';
import { HistoryPage } from './pages/HistoryPage';
import { HistoryDetailPage } from './pages/HistoryDetailPage';
import { FoodLibraryPage } from './pages/FoodLibraryPage';
import { PublicFoodReviewPage } from './pages/PublicFoodReviewPage';
import { PlanPage } from './pages/PlanPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccountInfoPage } from './pages/AccountInfoPage';
import { ProfileInfoPage } from './pages/ProfileInfoPage';
import { SettingsVersionPage } from './pages/SettingsVersionPage';
import { VersionFeedbackPage } from './pages/VersionFeedbackPage';
import { SettingsIntakePlanPage } from './pages/SettingsIntakePlanPage';
import { SettingsRecordSettingsPage } from './pages/SettingsRecordSettingsPage';
import { LoginPage } from './pages/LoginPage';
import { StoreProvider } from './store';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { registerAuthListener, unregisterAuthListener } from './lib/authState';
import { finalizeLoginPerfAttempt, getActiveLoginPerfTrace, markLoginPerf } from './lib/loginPerf';

function LoginPerfRouteProbe({ isAuthenticated }) {
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated || location.pathname === '/login') return;
    const activeTrace = getActiveLoginPerfTrace();
    if (!activeTrace || activeTrace.finalized) return;
    markLoginPerf('T8', { authenticatedPath: location.pathname });
    finalizeLoginPerfAttempt('success');
  }, [isAuthenticated, location.pathname]);

  return null;
}

/**
 * Configuration Error Page
 */
function ConfigErrorPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#F7F7F5] to-[#EFF2ED] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-[#FF6B6B] flex items-center justify-center mx-auto mb-6">
          <span className="text-[32px]">⚠️</span>
        </div>
        <p className="text-[18px] font-medium text-[#2C332F] mb-4">Supabase 尚未配置</p>
        <p className="text-[14px] text-[#858C88] mb-6 leading-relaxed">
          请在 <code className="bg-[#E5E5E0] px-2 py-1 rounded">.env.local</code> 文件中设置以下环境变量：
        </p>
        <div className="bg-white border border-[#E5E5E0] rounded-2xl p-4 mb-6 text-left">
          <p className="text-[12px] font-mono text-[#2C332F] mb-2">REACT_APP_SUPABASE_URL=your_supabase_url</p>
          <p className="text-[12px] font-mono text-[#2C332F]">REACT_APP_SUPABASE_ANON_KEY=your_anon_key</p>
        </div>
        <p className="text-[12px] text-[#858C88] mb-6">
          配置完成后，请重新启动应用（Ctrl+C 然后 npm start）
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-2xl bg-[#2C332F] text-white text-[14px] font-medium"
        >
          重新检查
        </button>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitError, setAuthInitError] = useState(null);
  const mountedRef = useRef(true);
  const profileLoadRef = useRef({ userId: null, promise: null });
  const activeSessionUserRef = useRef(null);

  const fetchLegacyAdminFlag = useCallback(async (userId) => {
    if (!userId || !supabase) return false;

    try {
      const { data, error } = await supabase
        .from('app_admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) return true;

      const fallback = await supabase
        .from('app_admins')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      return Boolean(!fallback.error && fallback.data);
    } catch {
      return false;
    }
  }, []);

  const loadUserProfile = useCallback(async (userId) => {
    if (!userId || !mountedRef.current || !supabase) return;

    if (profileLoadRef.current.userId === userId && profileLoadRef.current.promise) {
      return profileLoadRef.current.promise;
    }

    const profilePromise = (async () => {
      markLoginPerf('T5', { profileUserId: userId });

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!mountedRef.current) return;

        if (error) {
          console.error('Failed to load profile:', error);
          setProfile(null);
          return;
        }

        const role = String(data?.role || '').toLowerCase();
        const accountType = String(data?.account_type || '').toLowerCase();
        const roleBasedAdmin = role === 'admin' || accountType === 'admin' || data?.is_admin === true;
        const legacyAdmin = roleBasedAdmin ? false : await fetchLegacyAdminFlag(userId);
        const computedRole = roleBasedAdmin || legacyAdmin ? 'admin' : 'user';

        setProfile({
          ...(data || {}),
          role: computedRole,
          is_admin: computedRole === 'admin',
        });
      } catch (err) {
        console.error('Error loading profile:', err);
        if (mountedRef.current) {
          setProfile(null);
        }
      } finally {
        markLoginPerf('T6');
      }
    })();

    profileLoadRef.current = { userId, promise: profilePromise };
    try {
      return await profilePromise;
    } finally {
      if (profileLoadRef.current.userId === userId) {
        profileLoadRef.current = { userId: null, promise: null };
      }
    }
  }, [fetchLegacyAdminFlag]);

  useEffect(() => {
    // Reset mounted flag on mount
    mountedRef.current = true;

    // Initialize auth
    const setupAuth = async () => {
      if (!supabase) {
        if (mountedRef.current) {
          setAuthInitError('Supabase 尚未配置');
          setIsLoading(false);
        }
        return;
      }

      try {
        // Check for existing session
        const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();

        if (!mountedRef.current) return; // Component unmounted

        if (sessionError) {
          console.error('Session check error:', sessionError);
          activeSessionUserRef.current = null;
          setSession(null);
          setUser(null);
          setProfile(null);
          setAuthInitError(null);
          setIsLoading(false);
          return;
        }

        if (existingSession?.user) {
          activeSessionUserRef.current = existingSession.user.id;
          setSession(existingSession);
          setUser(existingSession.user);
          // Load profile
          await loadUserProfile(existingSession.user.id);
        }

        if (!mountedRef.current) return; // Component unmounted

        setIsLoading(false);

        // Register auth state listener
        registerAuthListener((event, newSession) => {
          if (!mountedRef.current) return; // Component unmounted

          if (newSession?.user) {
            const nextUserId = newSession.user.id;
            const isSameUser = activeSessionUserRef.current === nextUserId;
            activeSessionUserRef.current = nextUserId;
            setSession(newSession);
            setUser(newSession.user);
            markLoginPerf('T7', { authEvent: event });
            if (!isSameUser) {
              setProfile(null);
              loadUserProfile(nextUserId).catch(console.error);
            }
          } else {
            activeSessionUserRef.current = null;
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        });
      } catch (err) {
        console.error('Auth setup error:', err);
        if (mountedRef.current) {
          activeSessionUserRef.current = null;
          setSession(null);
          setUser(null);
          setProfile(null);
          setAuthInitError(null);
          setIsLoading(false);
        }
      }
    };

    setupAuth();

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      unregisterAuthListener();
    };
  }, [loadUserProfile]);

  // Keep hook order stable: render config error after hooks are declared.
  if (!isSupabaseConfigured) {
    return (
      <div className="App">
        <ConfigErrorPage />
      </div>
    );
  }

  const handleLoginSuccess = (loggedInUser, loggedInSession) => {
    if (!mountedRef.current) return;
    if (activeSessionUserRef.current !== loggedInUser?.id) {
      setProfile(null);
    }
    activeSessionUserRef.current = loggedInUser?.id || null;
    setUser(loggedInUser);
    setSession(loggedInSession);
    markLoginPerf('T7', { authEvent: 'LOGIN_SUBMIT_SUCCESS' });
  };

  const isAuthenticated = Boolean(user && session);

  const componentEntries = [
    ['BrowserRouter', BrowserRouter],
    ['Routes', Routes],
    ['Route', Route],
    ['Navigate', Navigate],
    ['Toaster', Toaster],
    ['StoreProvider', StoreProvider],
    ['BottomNav', BottomNav],
    ['TodayPage', TodayPage],
    ['HistoryPage', HistoryPage],
    ['HistoryDetailPage', HistoryDetailPage],
    ['FoodLibraryPage', FoodLibraryPage],
    ['PublicFoodReviewPage', PublicFoodReviewPage],
    ['PlanPage', PlanPage],
    ['SettingsPage', SettingsPage],
    ['AccountInfoPage', AccountInfoPage],
    ['ProfileInfoPage', ProfileInfoPage],
    ['SettingsVersionPage', SettingsVersionPage],
    ['VersionFeedbackPage', VersionFeedbackPage],
    ['SettingsIntakePlanPage', SettingsIntakePlanPage],
    ['SettingsRecordSettingsPage', SettingsRecordSettingsPage],
    ['LoginPage', LoginPage],
  ];

  const invalidComponents = componentEntries.filter(([, component]) => {
    if (!component) return true;
    const type = typeof component;
    return type !== 'function' && type !== 'object';
  });

  if (invalidComponents.length > 0) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#F7F7F5] to-[#EFF2ED] flex items-center justify-center p-4">
        <div className="text-left w-full max-w-xl rounded-2xl border border-[#F2C2BE] bg-white p-4">
          <p className="text-[16px] font-medium text-[#8A3B34]">页面加载失败</p>
          <p className="text-[13px] text-[#6A6F6C] mt-2">
            检测到组件导出异常，请检查以下组件是否正确导出：
          </p>
          <ul className="mt-3 space-y-1 text-[12px] text-[#2C332F]">
            {invalidComponents.map(([name, component]) => (
              <li key={name}>- {name}（当前类型：{typeof component}）</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // State 1: Loading
  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#F7F7F5] to-[#EFF2ED] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E5E5E0] border-t-[#6B8067] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[14px] text-[#858C88]">正在检查登录状态...</p>
        </div>
      </div>
    );
  }

  // State 2: Auth Error
  if (authInitError) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#F7F7F5] to-[#EFF2ED] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-[16px] font-medium text-[#2C332F] mb-4">认证出错</p>
          <p className="text-[14px] text-[#858C88] mb-6">{authInitError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-2xl bg-[#2C332F] text-white text-[14px]"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  // State 3: Route app
  return (
    <div className="App">
      <BrowserRouter>
        <LoginPerfRouteProbe isAuthenticated={isAuthenticated} />
        {isAuthenticated ? (
          <StoreProvider user={user} session={session} profile={profile}>
            <div className="app-shell">
              <Routes>
                <Route path="/" element={<TodayPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/history/:dateStr" element={<HistoryDetailPage />} />
                <Route path="/library" element={<FoodLibraryPage />} />
                <Route path="/library/review" element={<PublicFoodReviewPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/account" element={<AccountInfoPage />} />
                <Route path="/settings/personal-info" element={<ProfileInfoPage />} />
                <Route path="/settings/profile" element={<Navigate to="/settings/personal-info" replace />} />
                <Route path="/settings/version" element={<SettingsVersionPage />} />
                <Route path="/settings/version/feedback" element={<VersionFeedbackPage />} />
                <Route path="/settings/intake-plan" element={<SettingsIntakePlanPage />} />
                <Route path="/settings/record-settings" element={<SettingsRecordSettingsPage />} />
                <Route path="/settings/account-actions" element={<Navigate to="/settings" replace />} />
                <Route path="/plan" element={<PlanPage />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <BottomNav />
            </div>
          </StoreProvider>
        ) : (
          <div className="app-shell">
            <Routes>
              <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        )}
        <Toaster position="top-center" richColors closeButton />
      </BrowserRouter>
    </div>
  );
}

export default App;
