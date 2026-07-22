import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '../services/authService';

export const LoginPage = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('请输入邮箱和密码');
      return;
    }

    setIsLoading(true);
    const { user, session, error } = await authService.signIn(email, password);

    if (error) {
      toast.error(`登录失败: ${error.message}`);
      setIsLoading(false);
      return;
    }

    if (user && session) {
      toast.success(`欢迎回来, ${email}!`);
      setIsLoading(false);
      onLoginSuccess(user, session);
    } else {
      toast.error('登录失败，请稍后重试');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#F7F7F5] to-[#EFF2ED] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#2C332F] flex items-center justify-center">
              <LogIn size={24} className="text-white" strokeWidth={1.8} />
            </div>
            <h1 className="text-[24px] font-medium text-[#2C332F]">饮食记录</h1>
          </div>
          <p className="text-[13px] text-[#858C88] tracking-wider">健康生活从记录开始</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-[12px] text-[#858C88] mb-2 font-medium">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={isLoading}
              className="w-full h-12 px-4 rounded-2xl border border-[#E5E5E0] bg-white text-[14px] text-[#2C332F] placeholder-[#858C88] focus:outline-none focus:border-[#6B8067] focus:ring-2 focus:ring-[#6B8067]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="login-email-input"
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-[12px] text-[#858C88] mb-2 font-medium">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              className="w-full h-12 px-4 rounded-2xl border border-[#E5E5E0] bg-white text-[14px] text-[#2C332F] placeholder-[#858C88] focus:outline-none focus:border-[#6B8067] focus:ring-2 focus:ring-[#6B8067]/20 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Footer Info */}
        <div className="mt-8 p-4 rounded-2xl bg-white border border-[#E5E5E0]">
          <p className="text-[12px] text-[#858C88] leading-relaxed">
            💡 <strong>提示：</strong>第一版本中，账号由管理员在 Supabase Dashboard 中创建。
            <br />
            请联系管理员创建您的登录账号。
          </p>
        </div>
      </div>
    </div>
  );
};
