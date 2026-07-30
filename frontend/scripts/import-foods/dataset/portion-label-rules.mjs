export const LABEL_RULES = {
  'cup': '杯',
  'tablespoon': '汤匙',
  'teaspoon': '茶匙',
  'slice': '片',
  'piece': '个',
  'serving': '份',
  'packet': '包',
  'can': '罐',
  'bottle': '瓶',
  'glass': '杯',
  'small': '小',
  'medium': '中等',
  'large': '大',
  'drained': '沥干',
  'heaped': '满勺',
  'level': '平勺'
};

export function translateLabel(label) {
  let zh = label.toLowerCase();
  for (const [en, cn] of Object.entries(LABEL_RULES)) {
    zh = zh.replace(en, cn);
  }
  return zh.charAt(0).toUpperCase() + zh.slice(1);
}
