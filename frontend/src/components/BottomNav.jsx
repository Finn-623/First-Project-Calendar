import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, Settings } from 'lucide-react';
import { useStore } from '../store';

const ITEMS = [
  { to: '/', label: '首页', icon: Home, testId: 'nav-home' },
  { to: '/library', label: '食物库', icon: BookOpen, testId: 'nav-library' },
  { to: '/settings', label: '设置', icon: Settings, testId: 'nav-settings' },
];

export const BottomNav = () => {
  const location = useLocation();
  const { goHome } = useStore();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E5E5E0] bg-[#F7F7F5] safe-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="bottom-nav"
    >
      <div className="grid grid-cols-3">
        {ITEMS.map(({ to, label, icon: Icon, testId }) => {
          const isCurrent = to === '/'
            ? location.pathname === '/'
            : location.pathname === to || location.pathname.startsWith(`${to}/`);

          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              data-testid={testId}
              onClick={(e) => {
                if (to === '/') {
                  void goHome();
                }

                if (isCurrent) {
                  e.preventDefault();
                }
              }}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-3 gap-1 ${
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
          );
        })}
      </div>
    </nav>
  );
};
