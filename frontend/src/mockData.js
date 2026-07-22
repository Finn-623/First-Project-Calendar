// Shared nutrition helpers (no mock/seed/demo data)

export const sumMealMacros = (foods = []) => {
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

export const sumTimelineMacros = (timeline = []) => {
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
