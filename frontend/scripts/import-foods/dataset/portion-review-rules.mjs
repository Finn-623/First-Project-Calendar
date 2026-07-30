const UNIT_TRANSLATIONS = new Map([
  ['cup or sachet', ['杯或小袋', 'other']],
  ['bowl, cup or sachet', ['碗、杯或小袋', 'other']],
  ['microwavable bag', ['微波加热袋', 'container']],
  ['microwavable cup', ['微波加热杯', 'container']],
  ['bagel', ['个贝果', 'natural_unit']],
  ['turkish bread', ['份土耳其面包', 'natural_unit']],
  ['baguette', ['份法棍', 'natural_unit']],
  ['ciabatta', ['份恰巴塔面包', 'natural_unit']],
  ['sourdough', ['份酸面包', 'natural_unit']],
  ['cobbette', ['段玉米', 'natural_unit']],
  ['baby corn', ['根小玉米', 'natural_unit']],
  ['chip', ['片', 'natural_unit']],
  ['sandwich thin', ['片三明治薄面包', 'natural_unit']],
  ['bun or roll', ['个餐包', 'natural_unit']],
  ['roll', ['个餐包', 'natural_unit']],
  ['drumstick', ['只鸡腿', 'natural_unit']],
  ['thigh', ['块鸡腿肉', 'natural_unit']],
  ['wing', ['只鸡翅', 'natural_unit']],
  ['chop', ['块肉排', 'natural_unit']],
  ['meatball', ['个肉丸', 'natural_unit']],
  ['prawn/shrimp', ['只虾', 'natural_unit']],
  ['abalone', ['只鲍鱼', 'natural_unit']],
  ['mussel', ['只贻贝', 'natural_unit']],
  ['scallop', ['只扇贝', 'natural_unit']],
  ['calamari ring', ['个鱿鱼圈', 'natural_unit']],
  ['egg yolk', ['个蛋黄', 'natural_unit']],
  ['bocconcini', ['个博康奇尼奶酪球', 'natural_unit']],
  ['cube', ['块', 'natural_unit']],
  ['bite', ['口', 'natural_unit']],
  ['strip', ['条', 'natural_unit']],
  ['stick', ['根', 'natural_unit']],
  ['stalk', ['根茎', 'natural_unit']],
  ['clove', ['瓣', 'natural_unit']],
  ['slice or segment', ['瓣或片', 'natural_unit']],
  ['slice or ring', ['片或圈', 'natural_unit']],
  ['cube or lump', ['块', 'natural_unit']],
  ['espresso cup', ['杯意式浓缩咖啡', 'cup']],
  ['punnet', ['盒', 'container']],
  ['snack pot', ['小盒', 'container']],
  ['pouch', ['袋', 'container']],
  ['tub or container', ['盒', 'container']],
  ['fruit', ['个', 'natural_unit']],
  ['quarter melon', ['四分之一个瓜', 'natural_unit']],
  ['spray', ['次喷用量', 'other']]
]);

for (const name of [
  'capsicum', 'eggplant', 'mushroom', 'carrot', 'melon', 'lettuce',
  'peach', 'avocado', 'leek', 'beetroot', 'onion', 'mango', 'potato',
  'chilli', 'swede', 'kiwifruit', 'nectarine', 'pear', 'celeriac',
  'choko', 'endive', 'okra', 'spring onion', 'parsnip', 'radish',
  'shallot', 'squash', 'taro', 'tomato', 'banana', 'custard apple',
  'fig', 'guava', 'jackfruit', 'lemon', 'lime', 'loquat', 'lychee',
  'passionfruit', 'pawpaw', 'plum'
]) {
  UNIT_TRANSLATIONS.set(name, ['个', 'natural_unit']);
}

const DETAIL_TRANSLATIONS = new Map([
  ['small', '小'],
  ['medium', '中等大小'],
  ['large', '大'],
  ['very small', '特小'],
  ['extra large', '特大'],
  ['extra large/giant', '特大'],
  ['small/medium', '小到中等'],
  ['medium/large', '中到大'],
  ['large/extra large', '大到特大'],
  ['medium or small', '小到中等'],
  ['small/baby', '小或迷你'],
  ['chat/baby', '迷你'],
  ['mini/snacking', '迷你零食装'],
  ['small/mini', '小或迷你'],
  ['mini', '迷你'],
  ['regular', '常规大小'],
  ['regular size', '常规大小'],
  ['family size', '家庭装'],
  ['snack size', '零食装'],
  ['single serve', '单人份'],
  ['individual serve', '单人份'],
  ['individual', '单人份'],
  ['whole', '整份'],
  ['slice', '切片'],
  ['thick', '厚'],
  ['thin', '薄'],
  ['sandwich size', '三明治大小'],
  ['half loaf', '半条'],
  ['dinner', '餐包'],
  ['damper', '澳式苏打面包'],
  ['foot long sub', '一英尺潜艇堡'],
  ['loin', '里脊'],
  ['king', '大号'],
  ['dressing', '调味用'],
  ['dry mix', '干粉'],
  ['pop top', '吸嘴装'],
  ['single shot', '单份浓缩'],
  ['double shot', '双份浓缩'],
  ['thai', '泰国品种'],
  ['lebanese', '黎巴嫩品种'],
  ['baby', '迷你'],
  ['lunch box', '便当大小'],
  ['lady finger', '小蕉品种'],
  ['medium (15 cm diameter)', '中等大小（直径15厘米）']
]);

const EXCLUDE_PRIMARY = new Set(['fish']);
const DEFER_PRIMARY = new Set(['spray']);

function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function reviewPortion(portion) {
  if (portion.review_note.includes('abnormal_weight')) {
    return {
      decision: 'defer',
      decision_reason: '异常小克重需要来源人工复核'
    };
  }
  if (portion.review_note.includes('conflicting_measure')) {
    return {
      decision: 'defer',
      decision_reason: '同一用户标签对应不同克重，当前无法安全确定'
    };
  }

  const [primaryRaw, ...detailRaw] = portion.source_descriptors.slice(0, 3);
  const primary = normalized(primaryRaw);
  const details = detailRaw.map(normalized).filter(Boolean);
  if (EXCLUDE_PRIMARY.has(primary)) {
    return {
      decision: 'exclude',
      decision_reason: '调查描述与当前食品份量身份不匹配，用户价值低'
    };
  }
  if (DEFER_PRIMARY.has(primary)) {
    return {
      decision: 'defer',
      decision_reason: '来源未说明喷用次数定义，不能安全解释为一次份量'
    };
  }

  const translated = UNIT_TRANSLATIONS.get(primary);
  const translatedDetails = details.map((detail) => DETAIL_TRANSLATIONS.get(detail));
  if (!translated || translatedDetails.some((value) => !value)) {
    return {
      decision: 'defer',
      decision_reason: '来源描述或包装/品牌语义无法在当前阶段可靠翻译'
    };
  }

  const quantity = String(portion.quantity);
  const detailText = translatedDetails.length
    ? `（${translatedDetails.join('、')}）`
    : '';
  return {
    decision: 'approve',
    final_label_en: portion.label_en,
    final_label_zh: `${quantity}${translated[0]}${detailText}`,
    final_portion_type: translated[1],
    decision_reason: '来源自然单位和规格明确，中文标签可可靠表达'
  };
}
