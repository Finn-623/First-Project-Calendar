const TITLE_MIN = 2;
const TITLE_MAX = 80;
const DESCRIPTION_MIN = 5;
const DESCRIPTION_MAX = 1000;

export function normalizeFeedbackInput(value) {
  return String(value || '').trim();
}

export function validateFeedbackForm({ title, description }) {
  const normalizedTitle = normalizeFeedbackInput(title);
  const normalizedDescription = normalizeFeedbackInput(description);
  const errors = {};

  if (!normalizedTitle) {
    errors.title = '请填写建议标题';
  } else if (normalizedTitle.length < TITLE_MIN || normalizedTitle.length > TITLE_MAX) {
    errors.title = '建议标题长度需在 2 到 80 个字符之间';
  }

  if (!normalizedDescription) {
    errors.description = '请填写详细说明';
  } else if (normalizedDescription.length < DESCRIPTION_MIN || normalizedDescription.length > DESCRIPTION_MAX) {
    errors.description = '详细说明长度需在 5 到 1000 个字符之间';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      title: normalizedTitle,
      description: normalizedDescription,
    },
  };
}

export function validateFeedbackStatus(status) {
  return status === 'pending' || status === 'completed';
}

export function validateCompletedVersion(version) {
  const normalized = normalizeFeedbackInput(version);

  if (!normalized) {
    return {
      valid: false,
      error: '请选择完成版本',
      normalized: '',
    };
  }

  if (normalized.length < 2 || normalized.length > 30) {
    return {
      valid: false,
      error: '完成版本长度需在 2 到 30 个字符之间',
      normalized,
    };
  }

  return {
    valid: true,
    error: '',
    normalized,
  };
}
