import React from 'react';
import { Link } from 'react-router-dom';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';

export const SettingsIntakePlanPage = () => {
  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="摄入计划"
        description="配置每日摄入目标，并管理历史计划。"
      />

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
        <Link
          to="/plan"
          className="block min-h-11 px-4 py-3 border-b border-[#F0EFE9] text-[13px] text-[#2C332F] hover:bg-[#F7F7F5]"
        >
          修改摄入计划
        </Link>
        <Link
          to="/plan"
          className="block min-h-11 px-4 py-3 text-[13px] text-[#2C332F] hover:bg-[#F7F7F5]"
        >
          查看历史计划
        </Link>
      </section>
    </div>
  );
};
