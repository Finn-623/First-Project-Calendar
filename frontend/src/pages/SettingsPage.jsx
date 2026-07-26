import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserRound, IdCard, History, LogOut, Repeat } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useStore } from '../store';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

const sections = [
  {
    title: '账户',
    items: [
      { to: '/settings/account', icon: IdCard, label: '账号信息', description: '查看当前账号基本信息' },
      { to: '/settings/profile', icon: UserRound, label: '个人信息', description: '查看个人资料与展示信息' },
    ],
  },
  {
    title: '记录',
    items: [
      { to: '/history', icon: History, label: '摄入记录历史', description: '进入历史记录页面' },
    ],
  },
];

export const SettingsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, user, authLoading, switchAccount, logout } = useStore();
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const displayName = useMemo(() => profile?.display_name || profile?.username || '用户', [profile]);
  const role = useMemo(() => {
    const rawRole = String(profile?.role || '').toLowerCase();
    return rawRole === 'admin' || profile?.is_admin === true ? '管理员' : '普通用户';
  }, [profile]);
  const username = profile?.username || '暂未填写';
  const status = user ? '已登录' : '未登录';

  const clearPrivateQueries = () => {
    queryClient.removeQueries({
      predicate: (query) => {
        const key = Array.isArray(query.queryKey) ? query.queryKey.join(':') : String(query.queryKey || '');
        return /(private|profile|user|timeline|history|plan|target|favorite|food_entries)/i.test(key);
      },
    });
  };

  const handleSwitchAccount = async () => {
    if (authLoading) return;
    const result = await switchAccount();

    if (!result?.success) {
      toast.error(result?.error || '切换账户失败，请检查网络后重试。');
      return;
    }

    clearPrivateQueries();
    setSwitchConfirmOpen(false);
    navigate('/login', {
      replace: true,
      state: { switchingAccount: true },
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
    setLogoutConfirmOpen(false);
    navigate('/login', {
      replace: true,
      state: { loggedOut: true },
    });
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <h1 className="text-[20px] font-medium text-[#2C332F] mb-4">设置</h1>

      <div className="rounded-2xl border border-[#E5E5E0] bg-white p-4 mb-4">
        <p className="text-[14px] text-[#2C332F] font-medium">{displayName}</p>
        <p className="text-[12px] text-[#858C88] mt-1">用户名：{username}</p>
        <p className="text-[12px] text-[#858C88] mt-1">角色：{role}</p>
        <p className="text-[12px] text-[#858C88] mt-1">状态：{status}</p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="mb-4">
          <h2 className="text-[12px] text-[#858C88] mb-2">{section.title}</h2>
          <div className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex items-center gap-3 px-4 py-3 border-b border-[#F0EFE9] last:border-b-0 hover:bg-[#F7F7F5]"
                >
                  <Icon size={16} className="text-[#6B8067]" />
                  <div className="min-w-0">
                    <p className="text-[13px] text-[#2C332F]">{item.label}</p>
                    <p className="text-[11px] text-[#858C88] truncate">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section>
        <h2 className="text-[12px] text-[#858C88] mb-2">账户操作</h2>
        <div className="rounded-2xl border border-[#E5E5E0] bg-white p-3 space-y-2">
          <button
            type="button"
            onClick={() => setSwitchConfirmOpen(true)}
            disabled={authLoading}
            className="w-full h-11 rounded-xl bg-[#EFF2ED] text-[#2C332F] text-[13px] font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            data-testid="settings-switch-account-btn"
          >
            <Repeat size={16} />
            {authLoading ? '正在切换...' : '切换账户'}
          </button>
          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            disabled={authLoading}
            className="w-full h-11 rounded-xl border border-[#E5E5E0] text-[#8F3A32] text-[13px] flex items-center justify-center gap-2 disabled:opacity-60"
            data-testid="settings-logout-btn"
          >
            <LogOut size={16} />
            {authLoading ? '正在退出...' : '退出账户'}
          </button>
        </div>
      </section>

      <AlertDialog open={switchConfirmOpen} onOpenChange={setSwitchConfirmOpen}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>切换账户</AlertDialogTitle>
            <AlertDialogDescription>
              确定要退出当前账户并登录其他账户吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={authLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSwitchAccount();
              }}
              disabled={authLoading}
              className="bg-[#6B8067] hover:bg-[#5A6D57]"
            >
              {authLoading ? '正在切换...' : '确认切换'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>退出账户</AlertDialogTitle>
            <AlertDialogDescription>
              确定要退出当前账户吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={authLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              disabled={authLoading}
              className="bg-[#8F3A32] hover:bg-[#7B2F28]"
            >
              {authLoading ? '正在退出...' : '退出'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
