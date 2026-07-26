export const hasMeaningfulTimelineItems = (timeline = []) => {
  const items = Array.isArray(timeline) ? timeline : [];

  return items.some((item) => {
    if (item?.type === 'meal') {
      return Array.isArray(item.foods) && item.foods.length > 0;
    }

    return item?.type === 'anaerobic' || item?.type === 'aerobic' || item?.type === 'event';
  });
};

export const filterMeaningfulTimelineItems = (timeline = []) => {
  const items = Array.isArray(timeline) ? timeline : [];

  return items.filter((item) => {
    if (item?.type === 'meal') {
      return Array.isArray(item.foods) && item.foods.length > 0;
    }

    return item?.type === 'anaerobic' || item?.type === 'aerobic' || item?.type === 'event';
  });
};