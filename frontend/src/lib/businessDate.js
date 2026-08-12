export const SYDNEY_TIME_ZONE = 'Australia/Sydney';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isBusinessDateKey = (value) => {
  const match = String(value || '').match(DATE_KEY_PATTERN);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year
    && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day;
};

export const getSydneyDateString = (instant = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant instanceof Date ? instant : new Date(instant));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const addDaysToDateString = (dateStr, days = 1) => {
  if (!isBusinessDateKey(dateStr)) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
};

export const createDisplayDateFromBusinessDate = (dateStr) => {
  if (!isBusinessDateKey(dateStr)) return new Date(NaN);
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

export const formatBusinessDateLabel = (dateStr, { includeYear = false } = {}) => {
  if (!isBusinessDateKey(dateStr)) return String(dateStr || '');
  const [year, month, day] = dateStr.split('-').map(Number);
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return includeYear
    ? `${year}年${month}月${day}日`
    : `${month}月${day}日 · ${weekday}`;
};
