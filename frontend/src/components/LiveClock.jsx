import React from 'react';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { formatLiveTime } from '../lib/localDateTime';

export const LiveClock = () => {
  const now = useCurrentTime();

  return (
    <p
      className="mt-1.5 text-[14px] text-[#6E756F] font-num tabular-nums"
      data-testid="today-live-time"
      aria-label="当前时间"
    >
      {formatLiveTime(now)}
    </p>
  );
};
