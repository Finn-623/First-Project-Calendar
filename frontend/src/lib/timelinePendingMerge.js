const PENDING_STATUSES = new Set(['pending', 'syncing', 'failed']);

const entryKey = (entry) => entry?.clientMutationId || entry?.entryId || entry?.foodEntryId || entry?.id;

export const mergeRemoteTimelineWithLocalPending = (remoteTimeline = [], localTimeline = []) => {
  const remote = Array.isArray(remoteTimeline) ? remoteTimeline.map((item) => ({
    ...item,
    foods: Array.isArray(item?.foods) ? [...item.foods] : [],
  })) : [];

  (Array.isArray(localTimeline) ? localTimeline : []).forEach((localMeal) => {
    const pendingFoods = (localMeal?.foods || []).filter((food) => PENDING_STATUSES.has(food?.sync_status));
    if (!pendingFoods.length) return;

    let remoteMeal = remote.find((item) => item?.id === localMeal?.id);
    if (!remoteMeal && localMeal?.type === 'meal') {
      remoteMeal = remote.find((item) => item?.type === 'meal' && item?.subtype === localMeal?.subtype);
    }

    if (!remoteMeal) {
      remote.push({ ...localMeal, foods: pendingFoods });
      return;
    }

    const remoteKeys = new Set((remoteMeal.foods || []).map(entryKey).filter(Boolean));
    pendingFoods.forEach((food) => {
      const key = entryKey(food);
      if (!key || !remoteKeys.has(key)) remoteMeal.foods.push(food);
    });
  });

  return remote;
};

export const filterPendingDeletedFoodEntries = (timeline = [], pendingDeleteEntryIds = []) => {
  const deletedIds = pendingDeleteEntryIds instanceof Set
    ? pendingDeleteEntryIds
    : new Set(pendingDeleteEntryIds || []);
  if (!deletedIds.size) return timeline;

  return (timeline || []).map((item) => ({
    ...item,
    foods: (item?.foods || []).filter((food) => {
      const id = food?.entryId || food?.foodEntryId || food?.id;
      return !id || !deletedIds.has(String(id));
    }),
  }));
};
