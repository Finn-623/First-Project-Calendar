const pad2 = (value) => String(value).padStart(2, '0');

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
