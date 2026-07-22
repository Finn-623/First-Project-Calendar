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
import { supabase } from './lib/supabaseClient';
import { registerAuthListener, unregisterAuthListener } from './lib/authState';

// Make supabase client available globally for authState module
window.supabaseClient = supabase;

function App() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitError, setAuthInitError] = useState(null);
  const initRefRef = useRef(false);

  useEffect(() => {
    // Initialize auth once on app startup
    const setupAuth = async () => {
      if (initRefRef.current) return;
      initRefRef.current = true;

      try {
        // Check for existing session
        const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();

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

        setIsLoading(false);

        // Register auth state listener
        registerAuthListener((event, newSession) => {
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
        setAuthInitError('认证初始化失败');
        setIsLoading(false);
      }
    };

    setupAuth();

    // Cleanup on unmount
    return () => {
      unregisterAuthListener();
    };
  }, []);

  /**
   * Load user profile from Supabase
   * NOT called from auth listener callback - called after state update
   * Prevents async deadlock in onAuthStateChange
   */
  const loadUserProfile = async (userId) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load profile:', error);
        setProfile(null);
        return;
      }

      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
      setProfile(null);
    }
  };

  const handleLoginSuccess = (loggedInUser, loggedInSession) => {
    setUser(loggedInUser);
    setSession(loggedInSession);
    // Load profile after login
    loadUserProfile(loggedInUser.id).catch(console.error);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#F7F7F5] to-[#EFF2ED] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E5E5E0] border-t-[#6B8067] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[14px] text-[#858C88]">正在加载...</p>
        </div>
      </div>
    );
  }

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

  if (!user || !session) {
    return (
      <div className="App">
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        <Toaster position="top-center" richColors closeButton />
      </div>
    );
  }

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
