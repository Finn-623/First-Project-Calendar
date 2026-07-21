import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { BottomNav } from './components/BottomNav';
import { TodayPage } from './pages/TodayPage';
import { HistoryPage } from './pages/HistoryPage';
import { HistoryDetailPage } from './pages/HistoryDetailPage';
import { FoodLibraryPage } from './pages/FoodLibraryPage';
import { PlanPage } from './pages/PlanPage';
import { StoreProvider } from './store';

function App() {
  return (
    <div className="App">
      <StoreProvider>
        <BrowserRouter>
          <div className="app-shell">
            <Routes>
              <Route path="/" element={<TodayPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:dateStr" element={<HistoryDetailPage />} />
              <Route path="/library" element={<FoodLibraryPage />} />
              <Route path="/plan" element={<PlanPage />} />
            </Routes>
            <BottomNav />
            <Toaster position="top-center" richColors closeButton />
          </div>
        </BrowserRouter>
      </StoreProvider>
    </div>
  );
}

export default App;
