import React from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, History, BookOpen, Target } from 'lucide-react';
import { useStore } from '../store';

const ITEMS = [
  { to: '/', label: '今日', icon: CalendarDays, testId: 'nav-today' },
  { to: '/history', label: '历史', icon: History, testId: 'nav-history' },
  { to: '/library', label: '食物库', icon: BookOpen, testId: 'nav-library' },
  { to: '/plan', label: '摄入计划', icon: Target, testId: 'nav-plan' },
];

export const BottomNav = () => {
  const { profile } = useStore();
  const displayName = profile?.display_name || profile?.username || '用户';
  const isAdmin = Boolean(profile?.is_admin);

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 safe-bottom"
      data-testid="bottom-nav"
    >
      <div className="mx-3 mb-3 rounded-2xl bg-white/90 backdrop-blur-md border border-[#E5E5E0] shadow-[0_8px_24px_-8px_rgba(44,51,47,0.15)]">
        <div className="px-3 pt-2 pb-1.5 flex items-center justify-between border-b border-[#F0EFE9]">
          <p className="text-[11px] text-[#2C332F] truncate max-w-[65%]">{displayName}</p>
          {isAdmin && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFF2ED] text-[#6B8067]">管理员</span>
          )}
        </div>
        <div className="grid grid-cols-4">
          {ITEMS.map(({ to, label, icon: Icon, testId }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              data-testid={testId}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2.5 gap-1 ${
                  isActive ? 'text-[#6B8067]' : 'text-[#858C88]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                  <span className="text-[10.5px] tracking-wide">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};
