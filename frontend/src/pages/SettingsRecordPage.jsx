import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import { recordSettingsService } from '../services/recordSettingsService';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export const SettingsRecordPage = () => {
  const { user } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [archiveTime, setArchiveTime] = useState('00:00');
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [nextArchiveTime, setNextArchiveTime] = useState(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) {
        setError('未登录用户');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const result = await recordSettingsService.getSettings({ userId: user.id });

      if (result.success) {
        const data = result.data;
        setEnabled(data.auto_archive_enabled);
        setTimezone(data.timezone);

        // Parse time to HH:mm format
        if (data.auto_archive_time) {
          const timeStr = data.auto_archive_time.split(':').slice(0, 2).join(':');
          setArchiveTime(timeStr);
        }
      } else {
        setError(result.error);
      }

      setLoading(false);
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
      toast.success('记录设置已更新');
    } else {
      toast.error(result.error || '设置保存失败');
    }

    setSaving(false);
  }, [user?.id, enabled, archiveTime, timezone]);

  if (loading) {
    return (
      <div className="pb-32">
        <SettingsSubpageHeader title="记录设置" />
        <div className="px-5 pt-6">
          <div className="text-center text-sm text-[#858C88]">加载中...</div>
        </div>
      </div>
    );
  }

  if (error && !user?.id) {
    return (
      <div className="pb-32">
        <SettingsSubpageHeader title="记录设置" />
        <div className="px-5 pt-6">
          <div className="text-center text-sm text-[#D27D67]">记录设置加载失败，请重试</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <SettingsSubpageHeader title="记录设置" />

      <div className="px-5 pt-6 space-y-4">
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
