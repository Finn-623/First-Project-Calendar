import React, { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import {
  mapPasswordErrorMessage,
  validatePasswordForm,
} from '../../lib/accountUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const INITIAL_FORM = {
  currentPassword: '',
  nextPassword: '',
  confirmPassword: '',
};

const INITIAL_ERRORS = {
  currentPassword: '',
  nextPassword: '',
  confirmPassword: '',
};

export const ChangePasswordDialog = ({
  open,
  onOpenChange,
  authEmail,
  isChangingPassword,
  setIsChangingPassword,
  onSessionExpired,
}) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState(INITIAL_ERRORS);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNextPassword, setShowNextPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const canSubmit = useMemo(
    () => !isChangingPassword,
    [isChangingPassword]
  );

  const resetState = () => {
    setForm(INITIAL_FORM);
    setErrors(INITIAL_ERRORS);
    setShowCurrentPassword(false);
    setShowNextPassword(false);
    setShowConfirmPassword(false);
  };

  const handleOpenChange = (nextOpen) => {
    if (isChangingPassword) return;
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;
    setForm((prev) => ({ ...prev, [field]: nextValue }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isChangingPassword) return;

    const validation = validatePasswordForm(form);
    if (!validation.isValid) {
      setErrors((prev) => ({ ...prev, ...validation.errors }));
      return;
    }

    if (!authEmail) {
      const message = '无法获取当前账号认证信息，请重新登录';
      setErrors((prev) => ({ ...prev, currentPassword: message }));
      toast.error(message);
      return;
    }

    try {
      setIsChangingPassword(true);

      const verifyResult = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: form.currentPassword,
      });

      if (verifyResult.error) {
        const mappedMessage = mapPasswordErrorMessage(verifyResult.error);
        setErrors((prev) => ({ ...prev, currentPassword: mappedMessage }));
        toast.error(mappedMessage);
        return;
      }

      const updateResult = await supabase.auth.updateUser({
        password: form.nextPassword,
      });

      if (updateResult.error) {
        const mappedMessage = mapPasswordErrorMessage(updateResult.error);

        if (mappedMessage.includes('重新登录')) {
          toast.error('密码已修改，请使用新密码重新登录');
          resetState();
          onOpenChange(false);
          onSessionExpired();
          return;
        }

        toast.error(mappedMessage);
        setErrors((prev) => ({ ...prev, nextPassword: mappedMessage }));
        return;
      }

      resetState();
      onOpenChange(false);
      toast.success('密码修改成功');
    } catch (error) {
      const mappedMessage = mapPasswordErrorMessage(error);
      toast.error(mappedMessage);
      setErrors((prev) => ({ ...prev, nextPassword: mappedMessage }));
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>
            验证现有密码后设置新密码。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-[12px] text-[#555E59] mb-1.5">
              现有密码
            </label>
            <div className="relative">
              <Input
                id="current-password"
                aria-label="现有密码"
                type={showCurrentPassword ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={handleChange('currentPassword')}
                placeholder="请输入现有密码"
                autoComplete="current-password"
                className="pr-11"
                disabled={isChangingPassword}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#858C88] hover:text-[#2C332F]"
                aria-label={showCurrentPassword ? '隐藏现有密码' : '显示现有密码'}
                disabled={isChangingPassword}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.currentPassword ? <p className="text-[12px] text-[#B54747] mt-1">{errors.currentPassword}</p> : null}
          </div>

          <div>
            <label htmlFor="next-password" className="block text-[12px] text-[#555E59] mb-1.5">
              新密码
            </label>
            <div className="relative">
              <Input
                id="next-password"
                aria-label="新密码"
                type={showNextPassword ? 'text' : 'password'}
                value={form.nextPassword}
                onChange={handleChange('nextPassword')}
                placeholder="请输入新密码"
                autoComplete="new-password"
                className="pr-11"
                disabled={isChangingPassword}
              />
              <button
                type="button"
                onClick={() => setShowNextPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#858C88] hover:text-[#2C332F]"
                aria-label={showNextPassword ? '隐藏新密码' : '显示新密码'}
                disabled={isChangingPassword}
              >
                {showNextPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.nextPassword ? <p className="text-[12px] text-[#B54747] mt-1">{errors.nextPassword}</p> : null}
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-[12px] text-[#555E59] mb-1.5">
              再次输入新密码
            </label>
            <div className="relative">
              <Input
                id="confirm-password"
                aria-label="再次输入新密码"
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={handleChange('confirmPassword')}
                placeholder="请再次输入新密码"
                autoComplete="new-password"
                className="pr-11"
                disabled={isChangingPassword}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#858C88] hover:text-[#2C332F]"
                aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                disabled={isChangingPassword}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword ? <p className="text-[12px] text-[#B54747] mt-1">{errors.confirmPassword}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isChangingPassword}
            >
              取消
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isChangingPassword ? '修改中...' : '确认修改'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
