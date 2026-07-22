import React, { useEffect, useState, useRef } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { BottomNav } from './components/BottomNav';
import { TodayPage } from './pages/TodayPage';
import { HistoryPage } from './pages/HistoryPage';
import { HistoryDetailPage } from './pages/HistoryDetailPage';
import { FoodLibraryPage } from './pages/FoodLibraryPage';
import { PlanPage } from './pages/PlanPage';
import { LoginPage } from './pages/LoginPage';
import { StoreProvider } from './store';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { registerAuthListener, unregisterAuthListener } from './lib/authState';

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
          配置完成后，请重新启动应用（Ctrl+C 然后 yarn start）
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
  // Must check config first to avoid any Supabase calls before render
  if (!isSupabaseConfigured) {
    return (
      <div className="App">
        <ConfigErrorPage />
      </div>
    );
  }

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitError, setAuthInitError] = useState(null);
  const mountedRef = useRef(true);

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
          setAuthInitError('认证检查失败');
          setIsLoading(false);
          return;
        }

        if (existingSession?.user) {
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
            setSession(newSession);
            setUser(newSession.user);
            // Load profile asynchronously
            loadUserProfile(newSession.user.id).catch(console.error);
          } else {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        });
      } catch (err) {
        console.error('Auth setup error:', err);
        if (mountedRef.current) {
          setAuthInitError('认证初始化失败');
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
  }, []);

  /**
   * Load user profile from Supabase
   */
  const loadUserProfile = async (userId) => {
    if (!userId || !mountedRef.current || !supabase) return;

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

      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
      if (mountedRef.current) {
        setProfile(null);
      }
    }
  };

  const handleLoginSuccess = (loggedInUser, loggedInSession) => {
    if (!mountedRef.current) return;
    setUser(loggedInUser);
    setSession(loggedInSession);
    // Load profile after login
    loadUserProfile(loggedInUser.id).catch(console.error);
  };

  const handleLogout = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    if (mountedRef.current) {
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  };

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

  // State 3: Not logged in
  if (!user || !session) {
    return (
      <div className="App">
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        <Toaster position="top-center" richColors closeButton />
      </div>
    );
  }

  // State 4: Logged in
  return (
    <div className="App">
      <StoreProvider user={user} session={session} profile={profile}>
        <BrowserRouter>
          <div className="app-shell">
            <Routes>
              <Route path="/" element={<TodayPage onLogout={handleLogout} />} />
              <Route path="/history" element={<HistoryPage onLogout={handleLogout} />} />
              <Route path="/history/:dateStr" element={<HistoryDetailPage onLogout={handleLogout} />} />
              <Route path="/library" element={<FoodLibraryPage onLogout={handleLogout} />} />
              <Route path="/plan" element={<PlanPage onLogout={handleLogout} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <BottomNav onLogout={handleLogout} />
            <Toaster position="top-center" richColors closeButton />
          </div>
        </BrowserRouter>
      </StoreProvider>
    </div>
  );
}

export default App;
