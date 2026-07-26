import React from 'react';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';

export const ProfileInfoPage = () => {
  const { profile } = useStore();

  const rows = [
    { label: '性别', value: profile?.gender || '暂未填写' },
    { label: '身高', value: profile?.height ? `${profile.height} cm` : '暂未填写' },
    { label: '体重', value: profile?.weight ? `${profile.weight} kg` : '暂未填写' },
  ];

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="个人信息"
        description="身体信息展示与后续编辑入口。"
      />

      <div className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
        {rows.map((row) => (
          <div key={row.label} className="px-4 py-3 border-b border-[#F0EFE9] last:border-b-0">
            <p className="text-[11px] text-[#858C88]">{row.label}</p>
            <p className="text-[14px] text-[#2C332F] mt-1 break-all">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
