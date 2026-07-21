import React from 'react';

export const CircularProgress = ({
  value = 0,
  max = 100,
  size = 168,
  stroke = 12,
  color = '#6B8067',
  trackColor = '#E5E5E0',
  children,
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  const dash = circumference * pct;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          fill="none"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export const MacroBar = ({ label, value, max, color, testId }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const gap = Math.round(max - value);
  return (
    <div className="flex-1 min-w-0" data-testid={testId}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] text-[#858C88] tracking-wide">{label}</span>
        <span className="font-num text-xs text-[#2C332F]">
          <span className="font-medium">{Math.round(value)}</span>
          <span className="text-[#858C88]">/{max}g</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#E5E5E0] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color, transition: 'width 0.5s ease' }}
        />
      </div>
      <div className="mt-1 text-[10px] text-[#858C88]">
        {gap > 0 ? `还差 ${gap}g` : `已超 ${Math.abs(gap)}g`}
      </div>
    </div>
  );
};
