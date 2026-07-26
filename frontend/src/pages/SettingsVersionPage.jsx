import React from 'react';
import { Link } from 'react-router-dom';
import { APP_VERSION } from '../config/appVersion';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';

export const SettingsVersionPage = () => {
  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="版本信息"
        description="查看当前版本与历史更新记录。"
      />

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[11px] text-[#858C88]">当前版本</p>
          <p className="text-[14px] text-[#2C332F] mt-1">{APP_VERSION}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] text-[#858C88]">更新时间</p>
          <p className="text-[14px] text-[#2C332F] mt-1">以版本发布记录为准</p>
        </div>
      </section>

      <div className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
        <Link
          to="/history"
          className="block min-h-11 px-4 py-3 border-b border-[#F0EFE9] text-[13px] text-[#2C332F] hover:bg-[#F7F7F5]"
        >
          查看记录变更历史
        </Link>
        <Link
          to="/settings"
          className="block min-h-11 px-4 py-3 text-[13px] text-[#2C332F] hover:bg-[#F7F7F5]"
        >
          提交版本修改意见
        </Link>
      </div>
    </div>
  );
};
