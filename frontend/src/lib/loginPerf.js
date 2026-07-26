const IS_DEV = process.env.NODE_ENV !== 'production';
const TRACE_KEY = '__loginPerfTrace';
const SUMMARY_KEY = '__loginPerfSummaries';

function getNow() {
  if (typeof performance === 'undefined') return Date.now();
  return performance.now();
}

function getTrace() {
  if (typeof window === 'undefined') return null;
  return window[TRACE_KEY] || null;
}

function setTrace(trace) {
  if (typeof window === 'undefined') return;
  window[TRACE_KEY] = trace;
}

function pushSummary(summary) {
  if (typeof window === 'undefined') return;
  const existing = Array.isArray(window[SUMMARY_KEY]) ? window[SUMMARY_KEY] : [];
  existing.push(summary);
  window[SUMMARY_KEY] = existing.slice(-10);
}

function safeDuration(start, end) {
  if (typeof start !== 'number' || typeof end !== 'number') return null;
  return Math.max(0, end - start);
}

export function startLoginPerfAttempt() {
  if (!IS_DEV) return null;
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const trace = {
    id,
    startedAt: getNow(),
    marks: { T0: getNow() },
    meta: {},
    finalized: false,
  };
  setTrace(trace);
  return id;
}

export function markLoginPerf(stage, extra = {}) {
  if (!IS_DEV) return;
  const trace = getTrace();
  if (!trace || trace.finalized) return;
  trace.marks[stage] = getNow();
  trace.meta = { ...trace.meta, ...extra };
  setTrace(trace);
}

export function updateLoginPerfMeta(extra = {}) {
  if (!IS_DEV) return;
  const trace = getTrace();
  if (!trace || trace.finalized) return;
  trace.meta = { ...trace.meta, ...extra };
  setTrace(trace);
}

export function finalizeLoginPerfAttempt(status) {
  if (!IS_DEV) return null;
  const trace = getTrace();
  if (!trace || trace.finalized) return null;

  trace.finalized = true;
  trace.meta = {
    ...trace.meta,
    status,
    finalizedAt: getNow(),
  };

  const marks = trace.marks || {};
  const t0 = marks.T0;
  const t1 = marks.T1;
  const t2 = marks.T2;
  const t5 = marks.T5;
  const t6 = marks.T6;
  const t7 = marks.T7;
  const t8 = marks.T8;

  const summary = {
    attemptId: trace.id,
    status,
    usernameResolveMs: safeDuration(t1, t2),
    profileQueryMs: safeDuration(t5, t6),
    authStateWriteMs: safeDuration(t6, t7),
    routeEnterMs: safeDuration(t7, t8),
    totalMs: safeDuration(t0, t8 || trace.meta.finalizedAt),
    marks,
    meta: trace.meta,
  };

  // eslint-disable-next-line no-console
  console.groupCollapsed(`[LoginPerf] ${status} · ${summary.totalMs?.toFixed(1) || 'n/a'}ms`);
  // eslint-disable-next-line no-console
  console.table({
    usernameResolveMs: summary.usernameResolveMs,
    profileQueryMs: summary.profileQueryMs,
    authStateWriteMs: summary.authStateWriteMs,
    routeEnterMs: summary.routeEnterMs,
    totalMs: summary.totalMs,
  });
  // eslint-disable-next-line no-console
  console.log('meta', summary.meta);
  // eslint-disable-next-line no-console
  console.log('marks', summary.marks);
  // eslint-disable-next-line no-console
  console.groupEnd();

  pushSummary(summary);
  setTrace(trace);
  return summary;
}

export function getActiveLoginPerfTrace() {
  return getTrace();
}

export function getLoginPerfSummaries() {
  if (typeof window === 'undefined') return [];
  return Array.isArray(window[SUMMARY_KEY]) ? window[SUMMARY_KEY] : [];
}