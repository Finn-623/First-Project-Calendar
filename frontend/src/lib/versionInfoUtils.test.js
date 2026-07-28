import {
  formatLocalDateTime,
  formatReleaseTime,
  getFeedbackStatusLabel,
  getFeedbackStatusVariant,
} from './versionInfoUtils';

describe('versionInfoUtils', () => {
  test('missing release time should stay unfilled before deployment', () => {
    expect(formatReleaseTime(null)).toBe('未填写');
  });

  test('released time should format fixed timestamp', () => {
    const result = formatReleaseTime('2026-07-28T11:53:00+10:00');
    expect(result).toBe('2026年7月28日 11:53');
  });

  test('invalid release time should show fallback text', () => {
    expect(formatReleaseTime('invalid-time')).toBe('上线时间未记录');
  });

  test('formatLocalDateTime should format or fallback', () => {
    expect(formatLocalDateTime('2026-07-26T18:30:00+10:00')).toMatch(/2026/);
    expect(formatLocalDateTime('')).toBe('未记录');
  });

  test('feedback status labels should map correctly', () => {
    expect(getFeedbackStatusLabel('pending')).toBe('未完成');
    expect(getFeedbackStatusLabel('completed')).toBe('已完成');
  });

  test('feedback badge variants should map correctly', () => {
    expect(getFeedbackStatusVariant('pending')).toBe('outline');
    expect(getFeedbackStatusVariant('completed')).toBe('secondary');
  });
});
