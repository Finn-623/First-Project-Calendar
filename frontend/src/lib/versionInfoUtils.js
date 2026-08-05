export function formatReleaseTime(releasedAt, locale = 'zh-CN') {
  if (!releasedAt) return '尚未正式上线';

  try {
    const date = new Date(releasedAt);
    if (Number.isNaN(date.getTime())) {
      return '上线时间未记录';
    }

    return new Intl.DateTimeFormat(locale, {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return '上线时间未记录';
  }
}

export function formatLocalDateTime(value, locale = 'zh-CN') {
  if (!value) return '未记录';

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '未记录';

    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return '未记录';
  }
}

export function getLocalCalendarDayDifference(value, now = new Date()) {
  const submitted = value instanceof Date ? value : new Date(value);
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(submitted.getTime()) || Number.isNaN(current.getTime())) return 0;

  const submittedDay = Date.UTC(
    submitted.getFullYear(),
    submitted.getMonth(),
    submitted.getDate()
  );
  const currentDay = Date.UTC(
    current.getFullYear(),
    current.getMonth(),
    current.getDate()
  );

  return Math.max(0, Math.floor((currentDay - submittedDay) / 86_400_000));
}

export function getFeedbackStatusLabel(status) {
  if (status === 'completed') return '已完成';
  return '未完成';
}

export function getFeedbackStatusVariant(status) {
  return status === 'completed' ? 'secondary' : 'outline';
}

export const FEEDBACK_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

export function getFeedbackPriorityLabel(priority) {
  const labels = {
    P0: 'P0 · 最快速完成',
    P1: 'P1 · 下个版本上线前完成',
    P2: 'P2 · 本大版本完成',
    P3: 'P3 · 后续版本完成',
  };

  return labels[priority] || labels.P2;
}
