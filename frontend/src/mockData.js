// Mock data for the diet & schedule tracker prototype

export const DAILY_PLAN = {
  calories: 2100,
  protein: 140,
  fat: 65,
  carbs: 240,
};

// Food database (per 100g values)
export const FOOD_LIBRARY = [
  { id: 'f1', name: '燕麦片', category: '主食', cal100: 380, p100: 13, f100: 7, c100: 68 },
  { id: 'f2', name: '水煮鸡胸', category: '蛋白', cal100: 165, p100: 31, f100: 3.6, c100: 0 },
  { id: 'f3', name: '牛油果', category: '脂肪', cal100: 160, p100: 2, f100: 15, c100: 9 },
  { id: 'f4', name: '蓝莓', category: '水果', cal100: 57, p100: 0.7, f100: 0.3, c100: 14 },
  { id: 'f5', name: '糙米饭', category: '主食', cal100: 111, p100: 2.6, f100: 0.9, c100: 23 },
  { id: 'f6', name: '西兰花', category: '蔬菜', cal100: 34, p100: 2.8, f100: 0.4, c100: 7 },
  { id: 'f7', name: '三文鱼', category: '蛋白', cal100: 208, p100: 20, f100: 13, c100: 0 },
  { id: 'f8', name: '全麦面包', category: '主食', cal100: 247, p100: 13, f100: 4.2, c100: 41 },
  { id: 'f9', name: '希腊酸奶', category: '蛋白', cal100: 59, p100: 10, f100: 0.4, c100: 3.6 },
  { id: 'f10', name: '杏仁', category: '脂肪', cal100: 579, p100: 21, f100: 50, c100: 22 },
];

// Categories for filter chips
export const FOOD_CATEGORIES = ['全部', '主食', '蛋白', '脂肪', '蔬菜', '水果'];

// Helper: compute macros for a given food + grams
export const scale = (food, grams) => {
  const k = grams / 100;
  return {
    cal: Math.round(food.cal100 * k),
    p: +(food.p100 * k).toFixed(1),
    f: +(food.f100 * k).toFixed(1),
    c: +(food.c100 * k).toFixed(1),
  };
};

// Timeline items for TODAY
// type: 'meal' (breakfast/lunch/dinner/snack), 'anaerobic', 'aerobic', 'event'
export const TODAY_TIMELINE_INIT = [
  {
    id: 'm1',
    type: 'meal',
    subtype: 'breakfast',
    title: '早餐',
    time: '08:15',
    fixed: true,
    foods: [
      { foodId: 'f1', name: '燕麦片', grams: 60, ...scale(FOOD_LIBRARY[0], 60) },
      { foodId: 'f4', name: '蓝莓', grams: 80, ...scale(FOOD_LIBRARY[3], 80) },
    ],
  },
  {
    id: 'w1',
    type: 'anaerobic',
    title: '无氧训练',
    time: '10:30',
    detail: '胸 + 三头 · 45 分钟',
    caloriesBurned: 280,
  },
  {
    id: 'm2',
    type: 'meal',
    subtype: 'lunch',
    title: '午餐',
    time: '12:40',
    fixed: true,
    foods: [
      { foodId: 'f2', name: '水煮鸡胸', grams: 150, ...scale(FOOD_LIBRARY[1], 150) },
      { foodId: 'f5', name: '糙米饭', grams: 120, ...scale(FOOD_LIBRARY[4], 120) },
      { foodId: 'f6', name: '西兰花', grams: 100, ...scale(FOOD_LIBRARY[5], 100) },
    ],
  },
  {
    id: 's1',
    type: 'meal',
    subtype: 'snack',
    title: '加餐',
    time: '16:00',
    fixed: false,
    foods: [
      { foodId: 'f9', name: '希腊酸奶', grams: 150, ...scale(FOOD_LIBRARY[8], 150) },
    ],
  },
  {
    id: 'm3',
    type: 'meal',
    subtype: 'dinner',
    title: '晚餐',
    time: '19:20',
    fixed: true,
    foods: [
      { foodId: 'f7', name: '三文鱼', grams: 130, ...scale(FOOD_LIBRARY[6], 130) },
      { foodId: 'f3', name: '牛油果', grams: 50, ...scale(FOOD_LIBRARY[2], 50) },
    ],
  },
];

// History mock: last 4 days with full timelines
const F = FOOD_LIBRARY;
export const SEED_HISTORY = [
  {
    dateStr: '2026-02-17',
    dateLabel: '2月17日 · 周一',
    timeline: [
      { id: 'h1-m1', type: 'meal', subtype: 'breakfast', title: '早餐', time: '07:50', fixed: true, foods: [
        { foodId: 'f8', name: '全麦面包', grams: 80, ...scale(F[7], 80) },
        { foodId: 'f9', name: '希腊酸奶', grams: 120, ...scale(F[8], 120) },
      ]},
      { id: 'h1-w1', type: 'aerobic', title: '有氧训练', time: '09:30', detail: '慢跑 · 30 分钟', caloriesBurned: 285 },
      { id: 'h1-m2', type: 'meal', subtype: 'lunch', title: '午餐', time: '12:30', fixed: true, foods: [
        { foodId: 'f2', name: '水煮鸡胸', grams: 140, ...scale(F[1], 140) },
        { foodId: 'f5', name: '糙米饭', grams: 100, ...scale(F[4], 100) },
      ]},
      { id: 'h1-m3', type: 'meal', subtype: 'dinner', title: '晚餐', time: '18:50', fixed: true, foods: [
        { foodId: 'f7', name: '三文鱼', grams: 120, ...scale(F[6], 120) },
        { foodId: 'f6', name: '西兰花', grams: 100, ...scale(F[5], 100) },
      ]},
    ],
  },
  {
    dateStr: '2026-02-16',
    dateLabel: '2月16日 · 周日',
    timeline: [
      { id: 'h2-m1', type: 'meal', subtype: 'breakfast', title: '早餐', time: '09:00', fixed: true, foods: [
        { foodId: 'f1', name: '燕麦片', grams: 80, ...scale(F[0], 80) },
      ]},
      { id: 'h2-e1', type: 'event', title: '朋友聚餐', time: '11:30', detail: '和朋友吃火锅' },
      { id: 'h2-m2', type: 'meal', subtype: 'lunch', title: '午餐', time: '13:00', fixed: true, foods: [
        { foodId: 'f2', name: '水煮鸡胸', grams: 180, ...scale(F[1], 180) },
        { foodId: 'f5', name: '糙米饭', grams: 150, ...scale(F[4], 150) },
      ]},
      { id: 'h2-m3', type: 'meal', subtype: 'dinner', title: '晚餐', time: '19:30', fixed: true, foods: [
        { foodId: 'f7', name: '三文鱼', grams: 150, ...scale(F[6], 150) },
        { foodId: 'f3', name: '牛油果', grams: 60, ...scale(F[2], 60) },
      ]},
    ],
  },
  {
    dateStr: '2026-02-15',
    dateLabel: '2月15日 · 周六',
    timeline: [
      { id: 'h3-m1', type: 'meal', subtype: 'breakfast', title: '早餐', time: '08:30', fixed: true, foods: [
        { foodId: 'f1', name: '燕麦片', grams: 60, ...scale(F[0], 60) },
        { foodId: 'f4', name: '蓝莓', grams: 60, ...scale(F[3], 60) },
      ]},
      { id: 'h3-w1', type: 'anaerobic', title: '无氧训练', time: '10:00', detail: '背 + 二头 · 50 分钟', caloriesBurned: 310 },
      { id: 'h3-m2', type: 'meal', subtype: 'lunch', title: '午餐', time: '12:45', fixed: true, foods: [
        { foodId: 'f2', name: '水煮鸡胸', grams: 160, ...scale(F[1], 160) },
        { foodId: 'f6', name: '西兰花', grams: 120, ...scale(F[5], 120) },
      ]},
      { id: 'h3-m3', type: 'meal', subtype: 'dinner', title: '晚餐', time: '19:00', fixed: true, foods: [
        { foodId: 'f8', name: '全麦面包', grams: 60, ...scale(F[7], 60) },
        { foodId: 'f9', name: '希腊酸奶', grams: 150, ...scale(F[8], 150) },
      ]},
    ],
  },
  {
    dateStr: '2026-02-14',
    dateLabel: '2月14日 · 周五',
    timeline: [
      { id: 'h4-m1', type: 'meal', subtype: 'breakfast', title: '早餐', time: '08:00', fixed: true, foods: [
        { foodId: 'f9', name: '希腊酸奶', grams: 150, ...scale(F[8], 150) },
      ]},
      { id: 'h4-m2', type: 'meal', subtype: 'lunch', title: '午餐', time: '12:20', fixed: true, foods: [
        { foodId: 'f2', name: '水煮鸡胸', grams: 130, ...scale(F[1], 130) },
        { foodId: 'f5', name: '糙米饭', grams: 100, ...scale(F[4], 100) },
      ]},
      { id: 'h4-s1', type: 'meal', subtype: 'snack', title: '加餐', time: '16:30', fixed: false, foods: [
        { foodId: 'f10', name: '杏仁', grams: 20, ...scale(F[9], 20) },
      ]},
      { id: 'h4-m3', type: 'meal', subtype: 'dinner', title: '晚餐', time: '19:10', fixed: true, foods: [
        { foodId: 'f7', name: '三文鱼', grams: 110, ...scale(F[6], 110) },
      ]},
    ],
  },
];

// Sums helper
export const sumMealMacros = (foods) => {
  return foods.reduce(
    (acc, f) => ({
      cal: acc.cal + (f.cal || 0),
      p: +(acc.p + (f.p || 0)).toFixed(1),
      f: +(acc.f + (f.f || 0)).toFixed(1),
      c: +(acc.c + (f.c || 0)).toFixed(1),
    }),
    { cal: 0, p: 0, f: 0, c: 0 }
  );
};

export const sumTimelineMacros = (timeline) => {
  return timeline.reduce(
    (acc, item) => {
      if (item.type === 'meal') {
        const s = sumMealMacros(item.foods || []);
        return {
          cal: acc.cal + s.cal,
          p: +(acc.p + s.p).toFixed(1),
          f: +(acc.f + s.f).toFixed(1),
          c: +(acc.c + s.c).toFixed(1),
        };
      }
      return acc;
    },
    { cal: 0, p: 0, f: 0, c: 0 }
  );
};
