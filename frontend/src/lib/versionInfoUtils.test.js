import {
  formatLocalDateTime,
  formatReleaseTime,
  getFeedbackStatusLabel,
  getFeedbackStatusVariant,
  getVersionStatusLabel,
} from './versionInfoUtils';

describe('versionInfoUtils', () => {
  test('development release time should show not released text', () => {
    expect(formatReleaseTime(null)).toBe('开发中，尚未上线');
  });

  test('released time should format fixed timestamp', () => {
    const result = formatReleaseTime('2026-07-26T18:30:00+10:00');
    expect(result).not.toBe('开发中，尚未上线');
    expect(result).toMatch(/2026/);
  });

  test('invalid release time should show fallback text', () => {
    expect(formatReleaseTime('invalid-time')).toBe('上线时间未记录');
  });

  test('formatLocalDateTime should format or fallback', () => {
    expect(formatLocalDateTime('2026-07-26T18:30:00+10:00')).toMatch(/2026/);
    expect(formatLocalDateTime('')).toBe('未记录');
  });

  test('status labels should map correctly', () => {
    expect(getVersionStatusLabel('development')).toBe('开发中');
    expect(getVersionStatusLabel('released')).toBe('已上线');
    expect(getFeedbackStatusLabel('pending')).toBe('未完成');
    expect(getFeedbackStatusLabel('completed')).toBe('已完成');
  });

  test('feedback badge variants should map correctly', () => {
    expect(getFeedbackStatusVariant('pending')).toBe('outline');
    expect(getFeedbackStatusVariant('completed')).toBe('secondary');
  });
});
