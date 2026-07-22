export const round1 = (value) => Number(Number(value || 0).toFixed(1));

export const roundCalories = (value) => Math.round(Number(value || 0));

export const scaleFoodByQuantity = (food, quantity, per = 100) => {
  const base = Number(per) > 0 ? Number(per) : 100;
  const ratio = Number(quantity || 0) / base;
  return {
    cal: roundCalories((Number(food.cal100 || 0)) * ratio),
    p: round1((Number(food.p100 || 0)) * ratio),
    f: round1((Number(food.f100 || 0)) * ratio),
    c: round1((Number(food.c100 || 0)) * ratio),
  };
};

export const sumMealMacros = (foods = []) => foods.reduce(
  (acc, f) => ({
    cal: acc.cal + roundCalories(f.cal || 0),
    p: round1(acc.p + Number(f.p || 0)),
    f: round1(acc.f + Number(f.f || 0)),
    c: round1(acc.c + Number(f.c || 0)),
  }),
  { cal: 0, p: 0, f: 0, c: 0 },
);

export const sumTimelineMacros = (timeline = []) => timeline.reduce(
  (acc, item) => {
    if (item.type !== 'meal') return acc;
    const meal = sumMealMacros(item.foods || []);
    return {
      cal: acc.cal + meal.cal,
      p: round1(acc.p + meal.p),
      f: round1(acc.f + meal.f),
      c: round1(acc.c + meal.c),
    };
  },
  { cal: 0, p: 0, f: 0, c: 0 },
);
