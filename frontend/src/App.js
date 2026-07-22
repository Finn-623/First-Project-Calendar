import React, { useEffect, useState } from 'react';
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
import { authService } from './services/authService';

function App() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const initAuth = async () => {
      const { session: currentSession } = await authService.getSession();
      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
      }
      setIsLoading(false);
    };

    initAuth();

    // Listen for auth state changes
    const { data: subscription } = authService.onAuthStateChange((event, session) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
      } else {
        setSession(null);
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe?.();
    };
  }, []);

  const handleLoginSuccess = (loggedInUser, loggedInSession) => {
    setUser(loggedInUser);
    setSession(loggedInSession);
  };

  const handleLogout = async () => {
    await authService.signOut();
    setUser(null);
    setSession(null);
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
      <StoreProvider user={user}>
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
