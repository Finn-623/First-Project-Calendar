import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';

export const AccountInfoPage = () => {
  const { profile, user } = useStore();

  const role = profile?.role === 'admin' || profile?.is_admin === true ? '管理员' : '普通用户';

  const rows = [
    { label: '用户名', value: profile?.username || '暂未填写' },
    { label: '角色', value: role },
    { label: '账号状态', value: user ? '已登录' : '未登录' },
  ];

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <div className="mb-4">
        <Link to="/settings" className="text-[12px] text-[#6B8067]">返回设置</Link>
        <h1 className="text-[20px] font-medium text-[#2C332F] mt-2">账号信息</h1>
      </div>

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
