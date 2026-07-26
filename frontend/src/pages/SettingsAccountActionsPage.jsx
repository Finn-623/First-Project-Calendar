import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
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

export const SettingsAccountActionsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authLoading, logout } = useStore();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

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
      <SettingsSubpageHeader
        title="账号操作"
        description="退出当前账号。"
      />

      <section className="rounded-2xl border border-[#E5E5E0] bg-white p-3">
        <button
          type="button"
          onClick={() => setLogoutConfirmOpen(true)}
          disabled={authLoading}
          className="w-full min-h-11 rounded-xl border border-[#E5E5E0] text-[#8F3A32] text-[13px] flex items-center justify-center gap-2 disabled:opacity-60"
          data-testid="settings-logout-btn"
        >
          <LogOut size={16} />
          {authLoading ? '正在退出...' : '退出账户'}
        </button>
      </section>

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
