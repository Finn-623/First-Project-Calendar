export function formatReleaseTime(releasedAt, locale = 'zh-CN') {
  if (!releasedAt) return '未填写';

  try {
    const date = new Date(releasedAt);
    if (Number.isNaN(date.getTime())) {
      return '上线时间未记录';
    }

    return new Intl.DateTimeFormat(locale, {
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

export function getFeedbackStatusLabel(status) {
  if (status === 'completed') return '已完成';
  return '未完成';
}

export function getFeedbackStatusVariant(status) {
  return status === 'completed' ? 'secondary' : 'outline';
}
