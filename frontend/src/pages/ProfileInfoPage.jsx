import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { showSuccess } from '../lib/notifications';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import {
  PERSONAL_INFO_GENDER_OPTIONS,
  buildPersonalInfoUpdatePayload,
  computeAgeFromBirthDate,
  formatMetric,
  getGenderLabel,
  getTodayDateStringForInput,
  mapPersonalInfoSaveError,
  normalizePersonalInfoFromProfile,
  validatePersonalInfo,
} from '../lib/personalInfoUtils';

export const ProfileInfoPage = () => {
  const { user, profile, loadProfile, updatePersonalInfo } = useStore();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    gender: '',
    birthDate: '',
    heightCm: '',
    weightKg: '',
  });

  const baseData = useMemo(() => normalizePersonalInfoFromProfile(profile), [profile]);

  useEffect(() => {
    if (!editMode) {
      setFormData(baseData);
      setErrors({});
      setSaveError('');
    }
  }, [baseData, editMode]);

  useEffect(() => {
    if (!editMode) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        setEditMode(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editMode, saving]);

  const ageLabel = useMemo(() => {
    const age = computeAgeFromBirthDate(baseData.birthDate);
    return age == null ? '未设置' : `${age} 岁`;
  }, [baseData.birthDate]);

  const handleRetry = async () => {
    if (!user?.id || retrying) return;
    setRetrying(true);

    const result = await loadProfile(user.id);
    if (!result?.success) {
      toast.error(result?.error || '加载个人信息失败，请稍后重试');
    }

    setRetrying(false);
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    setSaveError('');
  };

  const handleSave = async () => {
    if (!user?.id || saving) return;

    const validated = validatePersonalInfo(formData);
    if (!validated.isValid) {
      setErrors(validated.errors);
      return;
    }

    const nextPayload = buildPersonalInfoUpdatePayload(baseData, formData);
    if (!nextPayload.hasChanges) {
      setEditMode(false);
      return;
    }

    setSaving(true);
    setSaveError('');

    const result = await updatePersonalInfo(user.id, nextPayload.payload);
    if (!result?.success) {
      const message = mapPersonalInfoSaveError(result?.error);
      setSaveError(message);
      toast.error(message);
      setSaving(false);
      return;
    }

    showSuccess('个人信息已保存');
    setSaving(false);
    setEditMode(false);
  };

  if (!profile) {
    return (
      <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
        <SettingsSubpageHeader
          title="个人信息"
          description="管理用于计划与数据计算的个人身体信息。"
        />

        <div className="rounded-2xl border border-[#E5E5E0] bg-white p-4">
          <p className="text-[13px] text-[#6A6F6C]">个人信息未加载，请重试。</p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="mt-3 min-h-11 px-4 rounded-lg text-[13px] bg-[#6B8067] text-white hover:bg-[#5D725A] disabled:opacity-55"
          >
            {retrying ? '重新加载中...' : '重新加载'}
          </button>
        </div>
      </div>
    );
  }

  const rows = [
    { label: '性别', value: getGenderLabel(baseData.gender) },
    { label: '生日', value: baseData.birthDate || '未设置' },
    { label: '年龄', value: ageLabel },
    { label: '身高', value: formatMetric(baseData.heightCm, 'cm') },
    { label: '体重', value: formatMetric(baseData.weightKg, 'kg') },
  ];

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="个人信息"
        description="管理用于计划与数据计算的个人身体信息。"
      />

      {!editMode ? (
        <>
          <div className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
            {rows.map((row) => (
              <div key={row.label} className="px-4 py-3 border-b border-[#F0EFE9] last:border-b-0">
                <p className="text-[11px] text-[#858C88]">{row.label}</p>
                <p className="text-[14px] text-[#2C332F] mt-1 break-all">{row.value}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="mt-4 w-full min-h-11 rounded-xl bg-[#6B8067] text-white text-[14px] hover:bg-[#5D725A]"
          >
            编辑
          </button>
        </>
      ) : (
        <div className="rounded-2xl border border-[#E5E5E0] bg-white p-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="personal-info-gender" className="text-[12px] text-[#6A6F6C]">性别</label>
              <select
                id="personal-info-gender"
                value={formData.gender}
                onChange={handleChange('gender')}
                className="mt-1 w-full min-h-11 rounded-lg border border-[#D5DCD2] bg-white px-3 text-[14px] text-[#2C332F]"
              >
                <option value="">未设置</option>
                {PERSONAL_INFO_GENDER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              {errors.gender ? <p className="mt-1 text-[12px] text-[#A8483E]">{errors.gender}</p> : null}
            </div>

            <div>
              <label htmlFor="personal-info-birth-date" className="text-[12px] text-[#6A6F6C]">生日</label>
              <input
                id="personal-info-birth-date"
                type="date"
                max={getTodayDateStringForInput()}
                value={formData.birthDate}
                onChange={handleChange('birthDate')}
                className="mt-1 w-full min-h-11 rounded-lg border border-[#D5DCD2] bg-white px-3 text-[14px] text-[#2C332F]"
              />
              {errors.birthDate ? <p className="mt-1 text-[12px] text-[#A8483E]">{errors.birthDate}</p> : null}
            </div>

            <div>
              <label htmlFor="personal-info-height" className="text-[12px] text-[#6A6F6C]">身高 (cm)</label>
              <input
                id="personal-info-height"
                type="text"
                inputMode="decimal"
                placeholder="例如 170 或 170.5"
                value={formData.heightCm}
                onChange={handleChange('heightCm')}
                className="mt-1 w-full min-h-11 rounded-lg border border-[#D5DCD2] bg-white px-3 text-[14px] text-[#2C332F]"
              />
              {errors.heightCm ? <p className="mt-1 text-[12px] text-[#A8483E]">{errors.heightCm}</p> : null}
            </div>

            <div>
              <label htmlFor="personal-info-weight" className="text-[12px] text-[#6A6F6C]">体重 (kg)</label>
              <input
                id="personal-info-weight"
                type="text"
                inputMode="decimal"
                placeholder="例如 65 或 65.5"
                value={formData.weightKg}
                onChange={handleChange('weightKg')}
                className="mt-1 w-full min-h-11 rounded-lg border border-[#D5DCD2] bg-white px-3 text-[14px] text-[#2C332F]"
              />
              {errors.weightKg ? <p className="mt-1 text-[12px] text-[#A8483E]">{errors.weightKg}</p> : null}
            </div>

            {saveError ? <p className="text-[12px] text-[#A8483E]">{saveError}</p> : null}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 min-h-11 rounded-lg bg-[#6B8067] text-white text-[14px] hover:bg-[#5D725A] disabled:opacity-55"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                disabled={saving}
                className="flex-1 min-h-11 rounded-lg border border-[#D5DCD2] text-[14px] text-[#2C332F] hover:bg-[#F6F8F5] disabled:opacity-55"
              >
                取消
              </button>
            </div>
            <p className="text-[11px] text-[#8A8F8C]">按 Esc 可取消编辑</p>
          </div>
        </div>
      )}
    </div>
  );
};
