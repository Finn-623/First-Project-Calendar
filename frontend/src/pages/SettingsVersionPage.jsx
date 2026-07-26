import React from 'react';
import { Link } from 'react-router-dom';
import { APP_VERSION, APP_VERSION_META, validateAppVersionMeta } from '../config/appVersion';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import {
  VERSION_CHANGE_CATEGORY_LABELS,
  VERSION_RECORDS,
} from '../data/versionHistory';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { formatReleaseTime, getVersionStatusLabel } from '../lib/versionInfoUtils';

function formatDateOnly(dateValue, locale = 'zh-CN') {
  if (!dateValue) return '未记录';

  try {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '未记录';

    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return '未记录';
  }
}

function groupChangesByCategory(changes = []) {
  return changes.reduce((acc, change) => {
    if (!acc[change.category]) {
      acc[change.category] = [];
    }

    acc[change.category].push(change);
    return acc;
  }, {});
}

export const SettingsVersionPage = () => {
  const versionCheck = validateAppVersionMeta(APP_VERSION_META);
  const currentVersionRecord =
    VERSION_RECORDS.find((record) => record.version === APP_VERSION) || VERSION_RECORDS[0] || null;
  const groupedCurrentChanges = currentVersionRecord
    ? groupChangesByCategory(currentVersionRecord.changes)
    : {};
  const orderedCurrentCategories = Object.keys(VERSION_CHANGE_CATEGORY_LABELS).filter(
    (categoryKey) => groupedCurrentChanges[categoryKey]?.length
  );

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="版本信息"
        description="查看当前版本、历史更新和改进任务。"
      />

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[11px] text-[#858C88]">当前版本号</p>
          <p className="text-[14px] text-[#2C332F] mt-1">v{APP_VERSION}</p>
          <p className="text-[12px] text-[#6B736F] mt-2">{currentVersionRecord?.name || '版本名称未记录'}</p>
        </div>
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[11px] text-[#858C88]">版本状态</p>
          <p className="text-[14px] text-[#2C332F] mt-1">{getVersionStatusLabel(APP_VERSION_META.status)}</p>
        </div>
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[11px] text-[#858C88]">上线时间</p>
          <p className="text-[14px] text-[#2C332F] mt-1">{formatReleaseTime(currentVersionRecord?.releaseDate)}</p>
        </div>
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[11px] text-[#858C88]">最后更新</p>
          <p className="text-[14px] text-[#2C332F] mt-1">{formatDateOnly(currentVersionRecord?.lastUpdatedDate)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] text-[#858C88]">版本概述</p>
          <p className="text-[13px] text-[#2C332F] mt-1 leading-6">{currentVersionRecord?.summary || '暂无版本概述'}</p>
        </div>
      </section>

      {!versionCheck.valid ? (
        <div className="rounded-2xl border border-[#F2C2BE] bg-[#FFF6F5] px-4 py-3 text-[13px] text-[#8A3B34] mb-4">
          {versionCheck.error}
        </div>
      ) : null}

      {currentVersionRecord?.highlights?.length ? (
        <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#F0EFE9]">
            <p className="text-[14px] font-medium text-[#2C332F]">本版本重点</p>
            <p className="text-[12px] text-[#858C88] mt-1">优先展示用户可直接感知的关键改动。</p>
          </div>
          <div className="px-4 py-3 space-y-2">
            {currentVersionRecord.highlights.slice(0, 6).map((item) => (
              <p key={item} className="text-[13px] text-[#2C332F] leading-6">
                - {item}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[14px] font-medium text-[#2C332F]">版本更新记录</p>
          <p className="text-[12px] text-[#858C88] mt-1">按版本归档，并按类别展开查看详细改动与证据提交。</p>
        </div>

        {VERSION_RECORDS.map((record) => {
          const groupedChanges = groupChangesByCategory(record.changes);
          const orderedCategories = Object.keys(VERSION_CHANGE_CATEGORY_LABELS).filter(
            (categoryKey) => groupedChanges[categoryKey]?.length
          );

          return (
            <div key={record.version} className="px-4 py-3 border-b border-[#F0EFE9] last:border-b-0">
              <p className="text-[14px] font-medium text-[#2C332F]">v{record.version}</p>
              <p className="text-[12px] text-[#6B736F] mt-1 leading-6">{record.summary}</p>
              <p className="text-[11px] text-[#858C88] mt-2">状态：{getVersionStatusLabel(record.status)}</p>
              <p className="text-[11px] text-[#858C88] mt-1">上线时间：{formatReleaseTime(record.releaseDate)}</p>
              <p className="text-[11px] text-[#858C88] mt-1">最后更新：{formatDateOnly(record.lastUpdatedDate)}</p>
              <p className="text-[11px] text-[#858C88] mt-1 break-all">详细文档：docs/version-updates/v{record.version}.md</p>

              {orderedCategories.length ? (
                <Accordion type="multiple" className="mt-3 border border-[#F0EFE9] rounded-xl px-3">
                  {orderedCategories.map((categoryKey) => (
                    <AccordionItem key={`${record.version}-${categoryKey}`} value={`${record.version}-${categoryKey}`}>
                      <AccordionTrigger className="text-[12px] text-[#2C332F] hover:no-underline">
                        <span>
                          {VERSION_CHANGE_CATEGORY_LABELS[categoryKey]}（{groupedChanges[categoryKey].length}）
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          {groupedChanges[categoryKey].map((change) => (
                            <div key={change.id} className="rounded-lg border border-[#F0EFE9] bg-[#FAFAF8] p-3">
                              <p className="text-[12px] font-medium text-[#2C332F]">{change.title}</p>
                              <p className="text-[11px] text-[#6B736F] mt-1">{change.summary}</p>
                              <p className="text-[11px] text-[#858C88] mt-1">日期：{formatDateOnly(change.date)}</p>
                              {change.details?.length ? (
                                <div className="mt-2 space-y-1">
                                  {change.details.map((detail) => (
                                    <p key={detail} className="text-[11px] text-[#4B524E] leading-5">
                                      - {detail}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                              {change.commitIds?.length ? (
                                <p className="text-[11px] text-[#858C88] mt-2 break-all">
                                  相关提交：{change.commitIds.join(', ')}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : null}
            </div>
          );
        })}
      </section>

      {currentVersionRecord && orderedCurrentCategories.length ? (
        <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#F0EFE9]">
            <p className="text-[14px] font-medium text-[#2C332F]">当前版本分类统计</p>
          </div>
          <div className="px-4 py-3 grid grid-cols-2 gap-2">
            {orderedCurrentCategories.map((categoryKey) => (
              <div key={categoryKey} className="rounded-lg border border-[#F0EFE9] bg-[#FAFAF8] px-3 py-2">
                <p className="text-[11px] text-[#858C88]">{VERSION_CHANGE_CATEGORY_LABELS[categoryKey]}</p>
                <p className="text-[14px] text-[#2C332F] mt-1">{groupedCurrentChanges[categoryKey].length}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
