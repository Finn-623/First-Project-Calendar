import React from 'react';
import { RECORD_MODE_LABELS, RECORD_MODES } from '../constants/recordModes';

export const RecordModeToggle = ({ value, onChange, disabled = false, liveDisabled = false, liveDisabledLabel = '只能在今天开始实时记录' }) => {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-2xl border border-[#E5E5E0]">
        {[
          { id: RECORD_MODES.manual, label: RECORD_MODE_LABELS.manual },
          { id: RECORD_MODES.live, label: RECORD_MODE_LABELS.live },
        ].map((item) => {
          const isLive = item.id === RECORD_MODES.live;
          const isDisabled = disabled || (isLive && liveDisabled);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (!isDisabled) onChange(item.id);
              }}
              disabled={isDisabled}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] ${
                value === item.id ? 'bg-[#6B8067] text-white' : 'text-[#858C88]'
              } ${isDisabled ? 'opacity-50' : ''}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {liveDisabled ? <p className="text-[11px] leading-4 text-[#D27D67] px-1">{liveDisabledLabel}</p> : null}
    </div>
  );
};
