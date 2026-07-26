const pad2 = (value) => String(value).padStart(2, '0');

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const parseClockText = (value) => {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || '0');

  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;

  return { hour, minute, second };
};

export const formatLiveTime = (date = new Date()) => {
  const next = date instanceof Date ? date : new Date(date);
  return `${pad2(next.getHours())}:${pad2(next.getMinutes())}:${pad2(next.getSeconds())}`;
};

export const getLocalTimeInputValue = (date = new Date()) => {
  const next = date instanceof Date ? date : new Date(date);
  return `${pad2(next.getHours())}:${pad2(next.getMinutes())}`;
};

export const getLocalDateKey = (date = new Date()) => {
  const next = date instanceof Date ? date : new Date(date);
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
};

export const formatClockTime = (value) => {
  if (value == null) return '';

  if (value instanceof Date) {
    if (!isValidDate(value)) return '';
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }

  if (typeof value === 'string') {
    const clockParts = parseClockText(value);
    if (clockParts) {
      return `${pad2(clockParts.hour)}:${pad2(clockParts.minute)}`;
    }

    const parsed = new Date(value);
    if (isValidDate(parsed)) {
      return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
    }
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    if (isValidDate(parsed)) {
      return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
    }
  }

  return '';
};

export const formatTimeInputWithSeconds = (value) => {
  if (value == null) return '';

  if (value instanceof Date) {
    if (!isValidDate(value)) return '';
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
  }

  if (typeof value === 'string') {
    const clockParts = parseClockText(value);
    if (clockParts) {
      return `${pad2(clockParts.hour)}:${pad2(clockParts.minute)}:${pad2(clockParts.second)}`;
    }

    const parsed = new Date(value);
    if (isValidDate(parsed)) {
      return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}:${pad2(parsed.getSeconds())}`;
    }
  }

  return '';
};

export const formatDuration = (totalSeconds) => {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const normalized = Math.floor(seconds);
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const remainSeconds = normalized % 60;

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(remainSeconds)}`;
};

export const diffSecondsBetween = (startDate, endDate) => {
  if (!isValidDate(startDate) || !isValidDate(endDate)) return null;
  const diff = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
};

export const secondsToDurationMinutes = (totalSeconds) => {
  const seconds = Number(totalSeconds);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.floor(seconds / 60);
};

export const buildLocalDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const normalizedTime = formatTimeInputWithSeconds(timeStr);
  if (!normalizedTime) return null;
  const next = new Date(`${dateStr}T${normalizedTime}`);
  return isValidDate(next) ? next : null;
};

export const resolveDurationSeconds = ({ startedAt, endedAt, durationMinutes }) => {
  const start = startedAt ? new Date(startedAt) : null;
  const end = endedAt ? new Date(endedAt) : null;

  if (isValidDate(start) && isValidDate(end)) {
    return diffSecondsBetween(start, end);
  }

  if (durationMinutes != null) {
    const minutes = Number(durationMinutes);
    if (Number.isFinite(minutes) && minutes >= 0) {
      return Math.floor(minutes * 60);
    }
  }

  return null;
};

export const combineLocalDateAndTime = (dateStr, timeStr) => {
  return buildLocalDateTime(dateStr, timeStr);
};

export const diffMinutesBetween = (startDate, endDate) => {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return null;
  const diff = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
};

