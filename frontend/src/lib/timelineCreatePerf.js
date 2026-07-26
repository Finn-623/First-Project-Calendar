const PERF_NAMESPACE = 'timeline-create-perf';

const isPerfAvailable = () => typeof window !== 'undefined' && typeof performance !== 'undefined';

const ensureStore = () => {
  if (!isPerfAvailable()) return null;

  if (!window.__timelineCreatePerfStore) {
    window.__timelineCreatePerfStore = {
      events: [],
      flows: {},
    };
  }

  return window.__timelineCreatePerfStore;
};

const eventName = (flowId, step) => `${PERF_NAMESPACE}:${flowId}:${step}`;

const pushEvent = (flowId, step, meta = {}) => {
  const store = ensureStore();
  if (!store) return;

  const timestamp = performance.now();
  store.events.push({ flowId, step, timestamp, meta });

  if (!store.flows[flowId]) {
    store.flows[flowId] = [];
  }

  store.flows[flowId].push({ step, timestamp, meta });
};

export const beginCreatePerfFlow = (flowType) => {
  if (!isPerfAvailable()) return null;

  const flowId = `${flowType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pushEvent(flowId, 'flow_begin', { flowType });

  return flowId;
};

export const markCreatePerf = (flowId, step, meta = {}) => {
  if (!flowId || !isPerfAvailable()) return;

  const name = eventName(flowId, step);
  performance.mark(name);
  pushEvent(flowId, step, meta);
};

export const measureCreatePerf = (flowId, name, startStep, endStep) => {
  if (!flowId || !isPerfAvailable()) return null;

  const startMark = eventName(flowId, startStep);
  const endMark = eventName(flowId, endStep);

  try {
    const metric = performance.measure(`${PERF_NAMESPACE}:${flowId}:${name}`, startMark, endMark);
    return metric.duration;
  } catch {
    return null;
  }
};

export const summarizeCreatePerfFlow = (flowId) => {
  if (!flowId || !isPerfAvailable()) return null;

  const store = ensureStore();
  const events = store?.flows?.[flowId] || [];
  if (!events.length) return null;

  const first = events[0].timestamp;
  const steps = events.map((event) => ({
    step: event.step,
    sinceStartMs: Number((event.timestamp - first).toFixed(2)),
    meta: event.meta || {},
  }));

  return {
    flowId,
    totalMs: Number((events[events.length - 1].timestamp - first).toFixed(2)),
    steps,
  };
};

export const getLatestCreatePerfSummaryByType = (flowType) => {
  const store = ensureStore();
  if (!store) return null;

  const flowIds = Object.keys(store.flows || {}).filter((id) => id.startsWith(`${flowType}-`));
  if (!flowIds.length) return null;

  const latestFlowId = flowIds[flowIds.length - 1];
  return summarizeCreatePerfFlow(latestFlowId);
};

export const clearCreatePerfStore = () => {
  const store = ensureStore();
  if (!store) return;

  store.events = [];
  store.flows = {};
};
