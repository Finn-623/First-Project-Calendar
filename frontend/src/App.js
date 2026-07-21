import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { BottomNav } from './components/BottomNav';
import { TodayPage } from './pages/TodayPage';
import { HistoryPage } from './pages/HistoryPage';
import { FoodLibraryPage } from './pages/FoodLibraryPage';
import { PlanPage } from './pages/PlanPage';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/library" element={<FoodLibraryPage />} />
            <Route path="/plan" element={<PlanPage />} />
          </Routes>
          <BottomNav />
          <Toaster position="top-center" richColors closeButton />
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
