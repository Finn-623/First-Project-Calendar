import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { showSuccess } from '../lib/notifications';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import { recordSettingsService } from '../services/recordSettingsService';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export const SettingsRecordPage = () => {
  const { user } = useStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Initialize from localStorage to avoid flicker
  const [savedEnabled, setSavedEnabled] = useState(() => {
    try {
      const cached = localStorage.getItem('recordSettings_savedEnabled');
      return cached ? JSON.parse(cached) : false;
    } catch {
      return false;
    }
  });
  const [savedArchiveTime, setSavedArchiveTime] = useState(() => {
    try {
      const cached = localStorage.getItem('recordSettings_savedArchiveTime');
      return cached ? JSON.parse(cached) : '00:00';
    } catch {
      return '00:00';
    }
  });
  const [savedTimezone, setSavedTimezone] = useState(() => {
    try {
      const cached = localStorage.getItem('recordSettings_savedTimezone');
      return cached ? JSON.parse(cached) : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    }
  });

  // Edit state (for form)
  const [enabled, setEnabled] = useState(() => {
    try {
      const cached = localStorage.getItem('recordSettings_savedEnabled');
      return cached ? JSON.parse(cached) : false;
    } catch {
      return false;
    }
  });
  const [archiveTime, setArchiveTime] = useState(() => {
    try {
      const cached = localStorage.getItem('recordSettings_savedArchiveTime');
      return cached ? JSON.parse(cached) : '00:00';
    } catch {
      return '00:00';
    }
  });
  const [timezone, setTimezone] = useState(() => {
    try {
      const cached = localStorage.getItem('recordSettings_savedTimezone');
      return cached ? JSON.parse(cached) : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    }
  });
  const [nextArchiveTime, setNextArchiveTime] = useState(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) {
        setError('未登录用户');
        return;
      }

      setError('');

      const result = await recordSettingsService.getSettings({ userId: user.id });

      if (result.success) {
        const data = result.data;
        
        // Parse time to HH:mm format
        let timeStr = '00:00';
        if (data.auto_archive_time) {
          timeStr = data.auto_archive_time.split(':').slice(0, 2).join(':');
        }

        // Update and cache saved state
        setSavedEnabled(data.auto_archive_enabled);
        setSavedArchiveTime(timeStr);
        setSavedTimezone(data.timezone);

        // Cache to localStorage
        localStorage.setItem('recordSettings_savedEnabled', JSON.stringify(data.auto_archive_enabled));
        localStorage.setItem('recordSettings_savedArchiveTime', JSON.stringify(timeStr));
        localStorage.setItem('recordSettings_savedTimezone', JSON.stringify(data.timezone));

        // Update edit state
        setEnabled(data.auto_archive_enabled);
        setArchiveTime(timeStr);
        setTimezone(data.timezone);
      } else {
        setError(result.error);
      }
    };

    loadSettings();
  }, [user?.id]);

  // Update next archive time whenever enabled or time changes
  useEffect(() => {
    if (enabled && archiveTime && timezone) {
      const nextTime = recordSettingsService.calculateNextArchiveTime({
        archiveTime,
        timezone,
      });
      setNextArchiveTime(nextTime);
    } else {
      setNextArchiveTime(null);
    }
  }, [enabled, archiveTime, timezone]);

  const handleSave = useCallback(async () => {
    if (!user?.id) {
      toast.error('未登录用户');
      return;
    }

    setSaving(true);

    const result = await recordSettingsService.upsertSettings({
      userId: user.id,
      autoArchiveEnabled: enabled,
      autoArchiveTime: archiveTime,
      timezone,
    });

    if (result.success) {
      showSuccess('记录设置已更新');
      // Update saved state
      setSavedEnabled(enabled);
      setSavedArchiveTime(archiveTime);
      setSavedTimezone(timezone);
      // Cache to localStorage
      localStorage.setItem('recordSettings_savedEnabled', JSON.stringify(enabled));
      localStorage.setItem('recordSettings_savedArchiveTime', JSON.stringify(archiveTime));
      localStorage.setItem('recordSettings_savedTimezone', JSON.stringify(timezone));
    } else {
      toast.error(result.error || '设置保存失败');
    }

    setSaving(false);
  }, [user?.id, enabled, archiveTime, timezone]);

  if (error && !user?.id) {
    return (
      <div className="w-full max-w-md mx-auto px-3 pt-6 pb-28">
        <SettingsSubpageHeader title="记录设置" />
        <div className="mt-6">
          <div className="text-center text-sm text-[#D27D67] leading-relaxed">
            <p className="font-medium mb-2">⚠️ 加载失败</p>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-3 pt-6 pb-28">
      <SettingsSubpageHeader title="记录设置" />

      <div className="space-y-4">
        {/* Current Status Card */}
        <div className="rounded-2xl border border-[#E5E5E0] bg-[#F5F8F3] p-4">
          <p className="text-[12px] text-[#858C88] mb-2">当前状态</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#2C332F]">自动归档</span>
              <span className={`text-[13px] font-medium ${savedEnabled ? 'text-[#6B8067]' : 'text-[#858C88]'}`}>
                {savedEnabled ? '已启用' : '已禁用'}
              </span>
            </div>
            {savedEnabled && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#2C332F]">归档时间</span>
                <span className="text-[13px] text-[#6B8067] font-medium">{savedArchiveTime}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#2C332F]">时区</span>
              <span className="text-[13px] text-[#858C88]">{savedTimezone}</span>
            </div>
          </div>
        </div>

        {/* Auto Archive Card */}
        <div className="rounded-2xl border border-[#E5E5E0] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-[14px] font-medium text-[#2C332F]">自动记录</h3>
              <p className="text-[12px] text-[#858C88] mt-1 leading-relaxed">
                开启后，系统将在设定时间自动结束当前记录周期，并将数据归档到历史记录。
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={saving}
              className="ml-3"
            />
          </div>

          {/* Time Selection */}
          {enabled && (
            <div className="mt-4 pt-4 border-t border-[#E5E5E0] space-y-3">
              <div>
                <label className="text-[12px] text-[#858C88] block mb-2">
                  每日归档时间
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={archiveTime}
                    onChange={(e) => setArchiveTime(e.target.value)}
                    disabled={saving}
                    className="flex-1 h-10 bg-white border-[#E5E5E0] rounded-lg"
                  />
                  <span className="text-[12px] text-[#858C88]">
                    {timezone}
                  </span>
                </div>
              </div>

              {/* Next Archive Time Display */}
              {nextArchiveTime && (
                <div className="text-[12px] text-[#6B8067] bg-[#F5F8F3] rounded-lg p-3">
                  <p className="font-medium mb-1">下次预计归档时间</p>
                  <p>
                    {nextArchiveTime.toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: timezone,
                    })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="rounded-2xl bg-[#F5F8F3] p-4 text-[12px] text-[#858C88] space-y-2">
          <p>• 设置时间后，系统每天将在该时间自动归档记录</p>
          <p>• 已手动归档的记录不会再次自动归档</p>
          <p>• 空的记录周期不会生成历史记录</p>
          <p>• 时区自动从浏览器检测</p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-2xl bg-[#2C332F] text-white text-[14px] font-medium disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
};
