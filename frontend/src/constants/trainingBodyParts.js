export const STRENGTH_BODY_PART_OPTIONS = [
  { value: 'chest', label: '胸' },
  { value: 'back', label: '背' },
  { value: 'legs', label: '腿' },
  { value: 'shoulders', label: '肩' },
  { value: 'biceps', label: '二头' },
  { value: 'triceps', label: '三头' },
  { value: 'core', label: '核心' },
];

const STRENGTH_BODY_PART_SET = new Set(STRENGTH_BODY_PART_OPTIONS.map((item) => item.value));
const STRENGTH_BODY_PART_LABEL_MAP = STRENGTH_BODY_PART_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const normalizeStrengthBodyParts = (input) => {
  if (!Array.isArray(input)) return [];

  const validSet = new Set(
    input
      .map((item) => String(item || '').trim())
      .filter((item) => STRENGTH_BODY_PART_SET.has(item))
  );

  return STRENGTH_BODY_PART_OPTIONS
    .map((item) => item.value)
    .filter((value) => validSet.has(value));
};

export const formatStrengthBodyPartsLabels = (input, separator = '、') => {
  const normalized = normalizeStrengthBodyParts(input);
  if (!normalized.length) return '';

  return normalized
    .map((value) => STRENGTH_BODY_PART_LABEL_MAP[value])
    .filter(Boolean)
    .join(separator);
};
