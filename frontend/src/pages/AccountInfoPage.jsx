import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { showSuccess } from '../lib/notifications';
import { useStore } from '../store';
import { supabase } from '../lib/supabaseClient';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { ChangePasswordDialog } from '../components/settings/ChangePasswordDialog';
import {
  mapAccountStatusLabel,
  mapDisplayNameUpdateError,
  mapRoleLabel,
  validateDisplayNameInput,
} from '../lib/accountUtils';

export const AccountInfoPage = () => {
  const { profile, user, authLoading, logout, loadProfile } = useStore();
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileReadError, setProfileReadError] = useState('');
  const displayNameInputRef = useRef(null);

  const roleLabel = useMemo(() => mapRoleLabel(profile), [profile]);
  const accountStatusLabel = useMemo(() => mapAccountStatusLabel(profile, user), [profile, user]);
  const authEmail = useMemo(() => String(user?.email || profile?.email || ''), [profile?.email, user?.email]);

  useEffect(() => {
    if (isEditingDisplayName && displayNameInputRef.current) {
      displayNameInputRef.current.focus();
      displayNameInputRef.current.select();
    }
  }, [isEditingDisplayName]);

  useEffect(() => {
    if (!profile && user?.id) {
      loadProfile(user.id)
        .then((result) => {
          if (!result?.success) {
            setProfileReadError('当前账号资料读取失败，请稍后重试');
          } else {
            setProfileReadError('');
          }
        })
        .catch(() => {
          setProfileReadError('当前账号资料读取失败，请稍后重试');
        });
    }
  }, [loadProfile, profile, user?.id]);

  const usernameValue = useMemo(() => {
    const value = String(profile?.username || '').trim();
    return value || '未设置';
  }, [profile?.username]);

  const displayNameValue = useMemo(() => {
    const value = String(profile?.display_name || '').trim();
    return value || '未设置';
  }, [profile?.display_name]);

  const emailValue = useMemo(() => {
    const value = String(user?.email || profile?.email || '').trim();
    return value || '未设置';
  }, [profile?.email, user?.email]);

  const beginDisplayNameEdit = () => {
    setDisplayNameDraft(String(profile?.display_name || ''));
    setDisplayNameError('');
    setIsEditingDisplayName(true);
  };

  const cancelDisplayNameEdit = () => {
    setDisplayNameDraft('');
    setDisplayNameError('');
    setIsEditingDisplayName(false);
  };

  const saveDisplayName = async () => {
    if (isSavingDisplayName) return;

    const validation = validateDisplayNameInput(displayNameDraft);
    if (!validation.isValid) {
      setDisplayNameError(validation.error);
      return;
    }

    const currentDisplayName = String(profile?.display_name || '').trim();
    if (validation.normalized === currentDisplayName) {
      cancelDisplayNameEdit();
      return;
    }

    if (!user?.id) {
      setDisplayNameError('无法获取当前账号资料，请重新登录');
      return;
    }

    setIsSavingDisplayName(true);
    setDisplayNameError('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: validation.normalized })
        .eq('id', user.id);

      if (error) {
        const message = mapDisplayNameUpdateError(error);
        setDisplayNameError(message);
        toast.error(message);
        return;
      }

      const refreshResult = await loadProfile(user.id);
      if (!refreshResult?.success) {
        const message = '展示名称已更新，但刷新页面资料失败';
        toast.error(message);
      } else {
        showSuccess('展示名称已更新');
      }

      cancelDisplayNameEdit();
    } catch (error) {
      const message = mapDisplayNameUpdateError(error);
      setDisplayNameError(message);
      toast.error(message);
    } finally {
      setIsSavingDisplayName(false);
    }
  };

  const handleDisplayNameKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelDisplayNameEdit();
    }
  };

  const handleSessionExpiredAfterPasswordChange = async () => {
    const result = await logout();
    if (!result?.success) {
      toast.error('会话状态异常，请手动重新登录');
      return;
    }

    window.location.assign('/login');
  };

  const canEditDisplayName = !isSavingDisplayName;

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="账户"
        description="管理你的基本账号信息、展示名称与密码安全。"
      />

      {profileReadError ? (
        <p className="text-[12px] text-[#B54747] mb-3">{profileReadError}</p>
      ) : null}

      <section className="mb-4">
        <h2 className="text-[12px] text-[#858C88] mb-2">账号信息</h2>
        <div className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F0EFE9]">
            <p className="text-[11px] text-[#858C88]">用户名</p>
            <p className="text-[14px] text-[#2C332F] mt-1 break-all">{usernameValue}</p>
          </div>

          <div className="px-4 py-3 border-b border-[#F0EFE9]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-[#858C88]">展示名称</p>
              {!isEditingDisplayName ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  onClick={beginDisplayNameEdit}
                  disabled={!canEditDisplayName}
                  data-testid="account-display-name-edit-btn"
                >
                  <PencilLine size={14} />
                  编辑
                </Button>
              ) : null}
            </div>

            {!isEditingDisplayName ? (
              <p className="text-[14px] text-[#2C332F] mt-1 break-all">{displayNameValue}</p>
            ) : (
              <div className="mt-2">
                <Input
                  ref={displayNameInputRef}
                  value={displayNameDraft}
                  onChange={(event) => {
                    setDisplayNameDraft(event.target.value);
                    setDisplayNameError('');
                  }}
                  onKeyDown={handleDisplayNameKeyDown}
                  aria-label="展示名称输入框"
                  maxLength={30}
                  disabled={isSavingDisplayName}
                />
                {displayNameError ? <p className="text-[12px] text-[#B54747] mt-1">{displayNameError}</p> : null}
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={saveDisplayName}
                    disabled={isSavingDisplayName}
                    data-testid="account-display-name-save-btn"
                  >
                    {isSavingDisplayName ? '保存中...' : '保存'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelDisplayNameEdit}
                    disabled={isSavingDisplayName}
                    data-testid="account-display-name-cancel-btn"
                  >
                    取消
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-b border-[#F0EFE9]">
            <p className="text-[11px] text-[#858C88]">用户角色</p>
            <div className="mt-1">
              <Badge variant="secondary" className="bg-[#EEF2EC] text-[#2C332F]">{roleLabel}</Badge>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-[#F0EFE9]">
            <p className="text-[11px] text-[#858C88]">账号状态</p>
            <div className="mt-1">
              <Badge variant="outline">{accountStatusLabel}</Badge>
            </div>
          </div>

          <div className="px-4 py-3">
            <p className="text-[11px] text-[#858C88]">邮箱</p>
            <p className="text-[14px] text-[#2C332F] mt-1 break-all">{emailValue}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-[12px] text-[#858C88] mb-2">登录安全</h2>
        <div className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setIsPasswordDialogOpen(true)}
            className="w-full min-h-12 px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#F7F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6B8067]/40"
            data-testid="account-change-password-entry"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-lg bg-[#EEF2EC] text-[#5F735B] flex items-center justify-center shrink-0">
                <KeyRound size={16} />
              </div>
              <div>
                <p className="text-[13px] text-[#2C332F]">修改密码</p>
                <p className="text-[11px] text-[#858C88] mt-0.5">定期更新密码可以提高账号安全性。</p>
              </div>
            </div>
            <span className="text-[#A0A79F]" aria-hidden>›</span>
          </button>
        </div>
      </section>

      <ChangePasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
        authEmail={authEmail}
        isChangingPassword={isChangingPassword || authLoading}
        setIsChangingPassword={setIsChangingPassword}
        onSessionExpired={handleSessionExpiredAfterPasswordChange}
      />
    </div>
  );
};
