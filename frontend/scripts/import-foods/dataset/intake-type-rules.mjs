export const ALLOWED_INTAKE_TYPES = [
  'carbohydrate',
  'protein',
  'fat',
  'fiber'
];

export const THRESHOLDS = {
  carbohydrate: { strong: 15, conditional: 8 },
  protein: { strong: 10, conditional: 5 },
  fat: { strong: 10, conditional: 5 },
  fiber: { strong: 3, conditional: 2 }
};

export const CONDITIONAL_CATEGORIES = {
  carbohydrate: new Set([
    'grains_staples',
    'potatoes_starchy_vegetables',
    'legumes_soy',
    'fruits',
    'dairy',
    'condiments_sauces'
  ]),
  protein: new Set([
    'meat_poultry',
    'fish_seafood',
    'eggs',
    'dairy',
    'legumes_soy',
    'nuts_seeds'
  ]),
  fat: new Set([
    'oils_fats',
    'nuts_seeds',
    'dairy',
    'eggs',
    'meat_poultry',
    'fish_seafood',
    'condiments_sauces'
  ]),
  fiber: new Set([
    'vegetables',
    'fruits',
    'legumes_soy',
    'grains_staples',
    'potatoes_starchy_vegetables',
    'nuts_seeds'
  ])
};

export function nutrientValue(food, type) {
  const value = food[`${type}_g`];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function assignByRules(food, category) {
  return ALLOWED_INTAKE_TYPES.filter((type) => {
    const value = nutrientValue(food, type);
    if (value === null) return false;
    const threshold = THRESHOLDS[type];
    return (
      value >= threshold.strong
      || (
        CONDITIONAL_CATEGORIES[type].has(category)
        && value >= threshold.conditional
      )
    );
  });
}

export function emptyAuditClassification(food, category) {
  const values = Object.fromEntries(
    ALLOWED_INTAKE_TYPES.map((type) => [type, nutrientValue(food, type)])
  );
  const name = food.name_en.toLowerCase();
  if (
    /^(water|salt),/.test(name)
    || /^tea,/.test(name)
    || /^coffee,/.test(name)
  ) {
    return {
      classification: 'expected_empty',
      reason: '食品不构成主要宏量营养摄入角色'
    };
  }

  const nearThreshold = ALLOWED_INTAKE_TYPES.some((type) => {
    const value = values[type];
    if (value === null) return false;
    const threshold = CONDITIONAL_CATEGORIES[type].has(category)
      ? THRESHOLDS[type].conditional
      : THRESHOLDS[type].strong;
    return value > 0 && value >= threshold - 2;
  });
  if (nearThreshold) {
    return {
      classification: 'threshold_boundary',
      reason: '营养值接近但未达到该分类适用阈值'
    };
  }
  return {
    classification: 'expected_empty',
    reason: '四项营养均未达到主要摄入角色阈值'
  };
}
