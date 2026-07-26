import React from 'react';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';

export const SettingsRecordSettingsPage = () => {
  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="记录设置"
        description="自动归档与记录规则相关设置将在后续版本完善。"
      />

      <section className="rounded-2xl border border-[#E5E5E0] bg-white px-4 py-4">
        <p className="text-[13px] text-[#2C332F]">自动归档</p>
        <p className="text-[11px] text-[#858C88] mt-1">当前默认于每日结束时归档记录。</p>
      </section>
    </div>
  );
};
