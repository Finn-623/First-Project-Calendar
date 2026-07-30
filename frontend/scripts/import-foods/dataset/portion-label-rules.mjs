export const PORTION_TYPES = [
  'natural_unit',
  'cup',
  'tablespoon',
  'teaspoon',
  'serving',
  'container',
  'other'
];

const TYPE_RULES = [
  ['cup', /^(cup|glass)$/],
  ['tablespoon', /^tablespoons?$/],
  ['teaspoon', /^teaspoons?$/],
  ['serving', /^(serving|serve)$/],
  ['container', /^(can|packet|bottle|carton|box|tub|jar|container|sachet|drink bottle)$/],
  ['natural_unit', /(slice|piece|egg|fillet|steak|chop|breast|tenderloin|prawn|shrimp|fruit|nut|handful|leaf|berry|grape|bunch|cob|banana|apple|orange|potato|sweet potato|sausage|patty|roll|bun|block|wedge|stick)/]
];

const UNIT_ZH = new Map([
  ['cup', '杯'],
  ['glass', '杯'],
  ['tablespoon', '汤匙'],
  ['tablespoons', '汤匙'],
  ['teaspoon', '茶匙'],
  ['teaspoons', '茶匙'],
  ['slice', '片'],
  ['piece', '块'],
  ['egg', '个'],
  ['fillet', '块鱼柳'],
  ['breast', '块鸡胸肉'],
  ['tenderloin', '条里脊'],
  ['prawn/shrimp', '只'],
  ['fruit', '个'],
  ['steak', '块'],
  ['chop', '块'],
  ['nut', '颗'],
  ['berry', '颗'],
  ['grape', '颗'],
  ['leaf', '片叶'],
  ['handful', '把'],
  ['bunch', '把'],
  ['cob', '根'],
  ['banana', '根'],
  ['apple', '个'],
  ['orange', '个'],
  ['potato', '个'],
  ['sweet potato', '个'],
  ['sausage', '根'],
  ['patty or rissole', '块'],
  ['bun or roll', '个'],
  ['roll', '个'],
  ['block', '块'],
  ['wedge', '块'],
  ['stick', '根'],
  ['serving', '份'],
  ['serve', '份'],
  ['can', '罐'],
  ['packet', '包'],
  ['sachet', '包'],
  ['box', '盒'],
  ['carton', '盒'],
  ['bottle', '瓶'],
  ['drink bottle', '瓶'],
  ['tub', '盒'],
  ['jar', '罐'],
  ['container', '容器']
]);

const DETAIL_ZH = new Map([
  ['small', '小'],
  ['medium', '中等大小'],
  ['large', '大'],
  ['regular', '常规大小'],
  ['thin', '薄'],
  ['thick', '厚'],
  ['drained', '沥干'],
  ['not drained', '未沥干'],
  ['heaped', '满勺'],
  ['level', '平勺'],
  ['single serve', '单人份'],
  ['bite-size', '一口大小'],
  ['cracker-size', '饼干大小'],
  ['sandwich size', '三明治大小'],
  ['half', '半份'],
  ['half loaf', '半条'],
  ['whole', '整份'],
  ['boneless', '去骨'],
  ['cooked', '熟制'],
  ['uncooked', '未烹调'],
  ['dried/uncooked', '干制、未烹调'],
  ['dry/uncooked', '干制、未烹调'],
  ['dry powder', '干粉'],
  ['mashed', '捣碎'],
  ['chopped', '切碎'],
  ['sliced', '切片'],
  ['diced', '切丁'],
  ['sliced/diced', '切片或切丁'],
  ['shredded/grated/cup', '切丝或磨碎'],
  ['quarters or chopped', '切成四份或切碎'],
  ['pieces', '块状'],
  ['sections', '分段'],
  ['sliced or cubed', '切片或切块'],
  ['medium/large', '中到大'],
  ['small/dinner sized', '小号餐包大小']
]);

export function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function determinePortionType(descriptor1) {
  const normalized = normalizeText(descriptor1).toLowerCase();
  return TYPE_RULES.find(([, pattern]) => pattern.test(normalized))?.[0] || 'other';
}

export function buildLabels(quantity, descriptors) {
  const normalizedQuantity = Number(quantity);
  const quantityText = Number.isFinite(normalizedQuantity)
    ? String(normalizedQuantity)
    : normalizeText(quantity);
  const clean = descriptors.map(normalizeText).filter(Boolean);
  const unit = clean[0]?.toLowerCase() || 'serving';
  const details = clean.slice(1).map((value) => value.toLowerCase());
  const labelEn = [quantityText, ...clean].filter(Boolean).join(' ');
  const translatedUnit = UNIT_ZH.get(unit);
  const translatedDetails = details.map((detail) => DETAIL_ZH.get(detail));
  const unknownTerms = [
    ...(translatedUnit ? [] : [clean[0] || '']),
    ...details.filter((_, index) => !translatedDetails[index])
  ].filter(Boolean);
  const detailText = translatedDetails.filter(Boolean).join('、');
  const labelZh = translatedUnit
    ? `${quantityText}${translatedUnit}${detailText ? `（${detailText}）` : ''}`
    : `${quantityText}份（原描述：${clean.join('；')}）`;

  return {
    label_en: labelEn,
    label_zh: labelZh,
    portion_type: determinePortionType(clean[0]),
    unknown_terms: unknownTerms
  };
}

export function semanticLabelKey(portion) {
  return [
    portion.portion_type,
    portion.label_en.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    portion.label_zh
  ].join('|');
}

export function portionPriority(portion) {
  const order = {
    natural_unit: 1,
    cup: 2,
    tablespoon: 3,
    teaspoon: 4,
    serving: 5,
    container: 6,
    other: 8
  };
  const sizeBonus = /\b(small|medium|large)\b/i.test(portion.label_en) ? -0.25 : 0;
  return (order[portion.portion_type] || 8) + sizeBonus;
}
