import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Archive,
  History,
  Info,
  LogOut,
  Target,
  UserRound,
} from 'lucide-react';
import { useStore } from '../store';
import { APP_VERSION } from '../config/appVersion';
import { SettingsNavigationItem } from '../components/settings/SettingsNavigationItem';

const sections = [
  {
    title: '账号',
    items: [
      {
        to: '/settings/account',
        icon: UserRound,
        label: '账户',
        description: '用户名、展示名称、角色、状态、邮箱与密码',
      },
      {
        to: '/settings/personal-info',
        icon: Activity,
        label: '个人信息',
        description: '性别、身高与体重',
      },
      {
        to: '/settings/version',
        icon: Info,
        label: '版本信息',
        description: '版本号、更新日志与修改意见',
      },
    ],
  },
  {
    title: '记录',
    items: [
      {
        to: '/settings/intake-plan',
        icon: Target,
        label: '摄入计划',
        description: '修改摄入计划并查看历史计划',
      },
      {
        to: '/settings/record-history',
        icon: History,
        label: '记录历史记录',
        description: '查看已归档的每日记录',
      },
      {
        to: '/settings/record-settings',
        icon: Archive,
        label: '记录设置',
        description: '自动归档与记录规则',
      },
    ],
  },
  {
    title: '账号操作',
    items: [
      {
        to: '/settings/account-actions',
        icon: LogOut,
        label: '账号操作',
        description: '退出当前账号',
      },
    ],
  },
];

export const SettingsPage = () => {
  const { profile } = useStore();

  const displayName = useMemo(() => {
    const value = String(profile?.display_name || '').trim();
    return value || '未设置展示名称';
  }, [profile?.display_name]);

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <h1 className="text-[20px] font-medium text-[#2C332F] mb-4">设置</h1>

      <div className="rounded-2xl border border-[#E5E5E0] bg-white px-4 py-3.5 mb-5">
        <p className="text-[14px] text-[#2C332F] font-medium">{displayName}</p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="mb-5">
          <h2 className="text-[12px] text-[#858C88] mb-2">{section.title}</h2>
          <div className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
            {section.items.map((item) => (
              <SettingsNavigationItem
                key={item.label}
                to={item.to}
                icon={item.icon}
                label={item.label}
                description={item.description}
                testId={`settings-entry-${item.to.replace('/settings/', '').replace('/', '-') || 'root'}`}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="pt-2 pb-2 text-center">
        <Link
          to="/settings/version"
          className="inline-flex min-h-11 items-center px-3 rounded-lg text-[12px] text-[#9AA19B] hover:text-[#6B8067] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8067]/35"
        >
          版本 {APP_VERSION}
        </Link>
      </div>
    </div>
  );
};
