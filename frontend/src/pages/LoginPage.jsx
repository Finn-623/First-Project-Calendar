import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authService } from '../services/authService';
import { APP_VERSION } from '../config/appVersion';
const INVALID_CREDENTIALS_MESSAGE = '用户名或密码错误';
const SERVICE_UNAVAILABLE_MESSAGE = '登录服务暂时不可用，请稍后重试';
const USERNAME_FORMAT_MESSAGE = '用户名只能包含3至30位小写字母、数字或下划线。';

export const LoginPage = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const isSwitchingAccount = location.state?.switchingAccount === true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const trimmedUsername = username.trim();
    const normalizedUsername = trimmedUsername.toLowerCase();

    if (!trimmedUsername || !password) {
      toast.error('请输入用户名和密码');
      setSubmitError('请输入用户名和密码');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUsername)) {
      toast.error(USERNAME_FORMAT_MESSAGE);
      setSubmitError(USERNAME_FORMAT_MESSAGE);
      return;
    }

    setIsLoading(true);
    const { user, session, error } = await authService.signInWithUsername(normalizedUsername, password);

    if (error) {
      if (error.message === USERNAME_FORMAT_MESSAGE || error.message === '用户名格式不正确') {
        toast.error(USERNAME_FORMAT_MESSAGE);
        setSubmitError(USERNAME_FORMAT_MESSAGE);
      } else if (error.message === INVALID_CREDENTIALS_MESSAGE) {
        toast.error(INVALID_CREDENTIALS_MESSAGE);
        setSubmitError(INVALID_CREDENTIALS_MESSAGE);
      } else {
        toast.error(SERVICE_UNAVAILABLE_MESSAGE);
        setSubmitError(SERVICE_UNAVAILABLE_MESSAGE);
      }
      setIsLoading(false);
      return;
    }

    if (user && session) {
      toast.success('欢迎回来');
      setIsLoading(false);
      setSubmitError('');
      onLoginSuccess(user, session);
      navigate('/', { replace: true });
    } else {
      toast.error(INVALID_CREDENTIALS_MESSAGE);
      setSubmitError(INVALID_CREDENTIALS_MESSAGE);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#F7F7F5] to-[#EFF2ED] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#2C332F] flex items-center justify-center">
              <LogIn size={24} className="text-white" strokeWidth={1.8} />
            </div>
            <h1 className="text-[24px] font-medium text-[#2C332F]">生活</h1>
          </div>
        </div>

        {/* Login Form */}
        {isSwitchingAccount && <div className="mb-4 rounded-2xl border border-[#E5E5E0] bg-white px-4 py-3 text-[13px] text-[#2C332F]">当前账户已退出，请登录其他账户。</div>}

        {submitError && !isSwitchingAccount && (
          <div className="mb-4 rounded-2xl border border-[#F1C7C2] bg-[#FFF7F6] px-4 py-3 text-[13px] text-[#8F3A32]" role="alert">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-[12px] text-[#858C88] mb-2 font-medium">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (submitError) setSubmitError('');
              }}
              placeholder="请输入用户名"
              disabled={isLoading}
              className="w-full h-12 px-4 rounded-2xl border border-[#E5E5E0] bg-white text-base md:text-[14px] text-[#2C332F] placeholder-[#858C88] focus:outline-none focus:border-[#6B8067] focus:ring-2 focus:ring-[#6B8067]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="login-username-input"
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-[12px] text-[#858C88] mb-2 font-medium">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (submitError) setSubmitError('');
              }}
              placeholder="••••••••"
              disabled={isLoading}
              className="w-full h-12 px-4 rounded-2xl border border-[#E5E5E0] bg-white text-base md:text-[14px] text-[#2C332F] placeholder-[#858C88] focus:outline-none focus:border-[#6B8067] focus:ring-2 focus:ring-[#6B8067]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="login-password-input"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-6 rounded-2xl bg-[#2C332F] hover:bg-[#1a1f1c] text-white text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="login-submit-btn"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>登录中...</span>
              </>
            ) : (
              <>
                <LogIn size={16} strokeWidth={1.8} />
                <span>登录</span>
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-[#A2A8A4]">
          当前版本：{APP_VERSION}
        </p>

      </div>
    </div>
  );
};
