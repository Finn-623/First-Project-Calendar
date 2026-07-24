import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { CalendarDays, History, BookOpen, Target, ChevronsUpDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useStore } from '../store';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

const ITEMS = [
  { to: '/', label: '今日', icon: CalendarDays, testId: 'nav-today' },
  { to: '/history', label: '历史', icon: History, testId: 'nav-history' },
  { to: '/library', label: '食物库', icon: BookOpen, testId: 'nav-library' },
  { to: '/plan', label: '摄入计划', icon: Target, testId: 'nav-plan' },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, user, authLoading, logout, switchAccount } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSwitchOpen, setConfirmSwitchOpen] = useState(false);

  const displayName = profile?.display_name || profile?.username || '用户';
  const displayEmail = user?.email || profile?.email || '未绑定邮箱';
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const avatarUrl = profile?.avatar_url || '';
  const avatarFallback = useMemo(() => {
    const raw = (displayName || displayEmail || 'U').trim();
    return raw.slice(0, 1).toUpperCase();
  }, [displayEmail, displayName]);

  const clearPrivateQueries = () => {
    queryClient.removeQueries({
      predicate: (query) => {
        const key = Array.isArray(query.queryKey) ? query.queryKey.join(':') : String(query.queryKey || '');
        return /(private|profile|user|timeline|history|plan|target|favorite|food_entries)/i.test(key);
      },
    });
  };

  const handleLogout = async () => {
    if (authLoading) return;
    const result = await logout();

    if (!result?.success) {
      toast.error(result?.error || '退出登录失败，请检查网络后重试。');
      return;
    }

    clearPrivateQueries();
    setMenuOpen(false);
    navigate('/login', {
      replace: true,
      state: { loggedOut: true },
    });
  };

  const handleConfirmSwitch = async () => {
    if (authLoading) return;
    const result = await switchAccount();

    if (!result?.success) {
      toast.error(result?.error || '切换账户失败，请检查网络后重试。');
      return;
    }

    clearPrivateQueries();
    setMenuOpen(false);
    setConfirmSwitchOpen(false);
    navigate('/login', {
      replace: true,
      state: { switchingAccount: true },
    });
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 safe-bottom"
        data-testid="bottom-nav"
      >
        <div className="mx-3 mb-3 rounded-2xl bg-white/90 backdrop-blur-md border border-[#E5E5E0] shadow-[0_8px_24px_-8px_rgba(44,51,47,0.15)] relative">
          <div className="px-3 pt-2 pb-1.5 flex items-center justify-between border-b border-[#F0EFE9]">
            <button
              type="button"
              className="flex items-center gap-2 min-w-0"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="打开账户菜单"
              data-testid="account-menu-trigger"
            >
              <Avatar className="h-7 w-7 border border-[#E5E5E0]">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                <AvatarFallback className="bg-[#EFF2ED] text-[#2C332F] text-[11px]">{avatarFallback}</AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0">
                <p className="text-[11px] text-[#2C332F] truncate max-w-[150px]">{displayName}</p>
                <p className="text-[10px] text-[#858C88] truncate max-w-[150px]">{displayEmail}</p>
              </div>
              <ChevronsUpDown size={14} className="text-[#858C88] shrink-0" />
            </button>

            {isAdmin && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFF2ED] text-[#6B8067]">管理员</span>
            )}
          </div>

          {menuOpen && (
            <div className="absolute left-3 right-3 bottom-[74px] rounded-2xl border border-[#E5E5E0] bg-white shadow-[0_12px_24px_-12px_rgba(44,51,47,0.35)] p-3 z-50" data-testid="account-menu-content">
              <div className="flex items-center gap-3 pb-3 border-b border-[#F0EFE9]">
                <Avatar className="h-10 w-10 border border-[#E5E5E0]">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                  <AvatarFallback className="bg-[#EFF2ED] text-[#2C332F]">{avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[13px] text-[#2C332F] truncate">{displayName}</p>
                  <p className="text-[11px] text-[#858C88] truncate">{displayEmail}</p>
                </div>
              </div>

              <div className="pt-3 space-y-2">
                <button
                  type="button"
                  className="w-full h-10 rounded-xl bg-[#EFF2ED] text-[#2C332F] text-[13px] font-medium disabled:opacity-60"
                  onClick={() => setConfirmSwitchOpen(true)}
                  disabled={authLoading}
                  data-testid="switch-account-btn"
                >
                  {authLoading ? '正在切换...' : '切换账户'}
                </button>
                <button
                  type="button"
                  className="w-full h-10 rounded-xl border border-[#E5E5E0] text-[#2C332F] text-[13px] disabled:opacity-60"
                  onClick={handleLogout}
                  disabled={authLoading}
                  data-testid="logout-btn"
                >
                  {authLoading ? '正在退出...' : '退出登录'}
                </button>
              </div>
            </div>
          )}

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

      <AlertDialog open={confirmSwitchOpen} onOpenChange={setConfirmSwitchOpen}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>切换账户</AlertDialogTitle>
            <AlertDialogDescription>
              确定要退出当前账户并登录其他账户吗？
              <br />
              你的云端数据不会被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={authLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmSwitch();
              }}
              disabled={authLoading}
              className="bg-[#6B8067] hover:bg-[#5a6d57]"
            >
              {authLoading ? '正在切换...' : '确认切换'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
