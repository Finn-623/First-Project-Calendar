import React from 'react';
import { Link } from 'react-router-dom';
import { APP_VERSION, APP_VERSION_META, validateAppVersionMeta } from '../config/appVersion';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import { VERSION_HISTORY_ENTRIES } from '../config/versionHistory';
import { formatReleaseTime, getVersionStatusLabel } from '../lib/versionInfoUtils';

export const SettingsVersionPage = () => {
  const versionCheck = validateAppVersionMeta(APP_VERSION_META);

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="版本信息"
        description="查看当前版本、历史更新和改进任务。"
      />

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[11px] text-[#858C88]">当前版本</p>
          <p className="text-[14px] text-[#2C332F] mt-1">{APP_VERSION}</p>
        </div>
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[11px] text-[#858C88]">上线时间</p>
          <p className="text-[14px] text-[#2C332F] mt-1">{formatReleaseTime(APP_VERSION_META.releasedAt)}</p>
        </div>
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[11px] text-[#858C88]">版本状态</p>
          <p className="text-[14px] text-[#2C332F] mt-1">{getVersionStatusLabel(APP_VERSION_META.status)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] text-[#858C88]">版本说明</p>
          <p className="text-[14px] text-[#2C332F] mt-1">{APP_VERSION_META.summary || '暂无版本说明'}</p>
        </div>
      </section>

      {!versionCheck.valid ? (
        <div className="rounded-2xl border border-[#F2C2BE] bg-[#FFF6F5] px-4 py-3 text-[13px] text-[#8A3B34] mb-4">
          {versionCheck.error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[14px] font-medium text-[#2C332F]">版本更新记录</p>
          <p className="text-[12px] text-[#858C88] mt-1">每个版本的详细说明保存在 docs/version-updates。</p>
        </div>
        {VERSION_HISTORY_ENTRIES.map((entry) => (
          <div key={entry.version} className="px-4 py-3 border-b border-[#F0EFE9] last:border-b-0">
            <p className="text-[13px] text-[#2C332F] font-medium">v{entry.version}</p>
            <p className="text-[12px] text-[#6B736F] mt-1">{entry.summary || '暂无摘要'}</p>
            <p className="text-[11px] text-[#858C88] mt-1">状态：{getVersionStatusLabel(entry.status)}</p>
            <p className="text-[11px] text-[#858C88] mt-1">上线时间：{formatReleaseTime(entry.releasedAt)}</p>
            <p className="text-[11px] text-[#858C88] mt-1 break-all">详细文档：{entry.docPath}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[14px] font-medium text-[#2C332F]">修改意见任务</p>
        </div>
        <Link
          to="/settings/version/feedback"
          className="block min-h-11 px-4 py-3 border-b border-[#F0EFE9] text-[13px] text-[#2C332F] hover:bg-[#F7F7F5]"
        >
          提交版本修改意见
        </Link>
        <div className="px-4 py-3 text-[12px] text-[#858C88]">记录改进建议并跟踪处理状态</div>
      </section>
    </div>
  );
};
