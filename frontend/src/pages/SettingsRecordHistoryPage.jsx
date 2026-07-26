import React from 'react';
import { Link } from 'react-router-dom';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';

export const SettingsRecordHistoryPage = () => {
  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="记录历史记录"
        description="查看并管理按日期归档的记录。"
      />

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
        <Link
          to="/history"
          className="block min-h-11 px-4 py-3 text-[13px] text-[#2C332F] hover:bg-[#F7F7F5]"
        >
          进入历史记录
        </Link>
      </section>
    </div>
  );
};
