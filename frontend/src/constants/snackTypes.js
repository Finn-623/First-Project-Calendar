export const SNACK_TYPES = [
  { value: 'normal', label: '普通' },
  { value: 'pre_workout', label: '练前' },
  { value: 'post_workout', label: '练后' },
];

export const SNACK_TYPE_LABELS = {
  normal: '普通',
  pre_workout: '练前',
  post_workout: '练后',
};

export const normalizeSnackType = (value) => {
  if (value === 'pre_workout' || value === 'post_workout' || value === 'normal') {
    return value;
  }

  return 'normal';
};
