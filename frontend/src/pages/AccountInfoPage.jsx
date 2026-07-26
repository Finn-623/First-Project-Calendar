import React from 'react';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';

export const AccountInfoPage = () => {
  const { profile, user } = useStore();

  const role = profile?.role === 'admin' || profile?.is_admin === true ? '管理员' : '普通用户';

  const rows = [
    { label: '展示名称', value: profile?.display_name || '暂未填写' },
    { label: '用户名', value: profile?.username || '暂未填写' },
    { label: '邮箱', value: profile?.email || user?.email || '暂未填写' },
    { label: '密码', value: '如需修改，请通过账号安全流程重置' },
    { label: '角色', value: role },
    { label: '账号状态', value: user ? '已登录' : '未登录' },
  ];

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="账户"
        description="查看账户核心信息。"
      />

      <div className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
        {rows.map((row) => (
          <div key={row.label} className="px-4 py-3 border-b border-[#F0EFE9] last:border-b-0">
            <p className="text-[11px] text-[#858C88]">{row.label}</p>
            <p className="text-[14px] text-[#2C332F] mt-1">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
