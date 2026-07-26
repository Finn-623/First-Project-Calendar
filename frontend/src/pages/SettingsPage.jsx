import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  Archive,
  History,
  Info,
  LogOut,
  Target,
  UserRound,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useStore } from '../store';
import { APP_VERSION } from '../config/appVersion';
import { SettingsNavigationItem } from '../components/settings/SettingsNavigationItem';
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
    title: '账号',
    items: [
      {
        to: '/settings/account',
        icon: UserRound,
        label: '账户',
        description: '管理个人账号资料与登录安全',
      },
      {
        to: '/settings/personal-info',
        icon: Activity,
        label: '个人信息',
        description: '性别、身高与体重',
      },
      {
        to: '/settings/version',
        icon: Info,
        label: '版本信息',
        description: '版本号、更新日志与修改意见',
      },
    ],
  },
  {
    title: '记录',
    items: [
      {
        to: '/settings/intake-plan',
        icon: Target,
        label: '摄入计划',
        description: '修改摄入计划并查看历史计划',
      },
      {
        to: '/settings/record-history',
        icon: History,
        label: '记录历史记录',
        description: '查看已归档的每日记录',
      },
      {
        to: '/settings/record-settings',
        icon: Archive,
        label: '记录设置',
        description: '自动归档与记录规则',
      },
    ],
  },
  {
    title: '账号操作',
    items: [
      {
        icon: LogOut,
        label: '退出账号',
        description: '退出当前账户',
        action: 'logout',
      },
    ],
  },
];

export const SettingsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, authLoading, logout } = useStore();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const displayName = useMemo(() => {
    const value = String(profile?.display_name || '').trim();
    return value || '未设置展示名称';
  }, [profile?.display_name]);

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
    setLogoutConfirmOpen(false);
    navigate('/login', {
      replace: true,
      state: { loggedOut: true },
    });
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <h1 className="text-[20px] font-medium text-[#2C332F] mb-4">设置</h1>

      <div className="rounded-2xl border border-[#E5E5E0] bg-white px-4 py-3.5 mb-5">
        <p className="text-[14px] text-[#2C332F] font-medium">{displayName}</p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="mb-5">
          <h2 className="text-[12px] text-[#858C88] mb-2">{section.title}</h2>
          <div className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
            {section.items.map((item) => (
              <SettingsNavigationItem
                key={item.label}
                to={item.to}
                onClick={item.action === 'logout' ? () => setLogoutConfirmOpen(true) : undefined}
                icon={item.icon}
                label={item.label}
                description={item.description}
                testId={item.action === 'logout'
                  ? 'settings-entry-account-actions'
                  : `settings-entry-${item.to.replace('/settings/', '').replace('/', '-') || 'root'}`}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="pt-2 pb-2 text-center">
        <Link
          to="/settings/version"
          className="inline-flex min-h-11 items-center px-3 rounded-lg text-[12px] text-[#9AA19B] hover:text-[#6B8067] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8067]/35"
        >
          版本 {APP_VERSION}
        </Link>
      </div>

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
