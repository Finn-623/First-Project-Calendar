import React from 'react';
import { UtensilsCrossed, Dumbbell, Footprints, MapPin, Plus, Clock } from 'lucide-react';
import { sumMealMacros } from '../mockData';

const iconFor = (item) => {
  if (item.type === 'meal') return UtensilsCrossed;
  if (item.type === 'anaerobic') return Dumbbell;
  if (item.type === 'aerobic') return Footprints;
  return MapPin;
};

const accentFor = (item) => {
  if (item.type === 'meal') return '#6B8067';
  if (item.type === 'anaerobic') return '#D27D67';
  if (item.type === 'aerobic') return '#D27D67';
  return '#E0B876';
};

export const TimelineItem = ({ item, onAddFood, onEditTime }) => {
  const Icon = iconFor(item);
  const accent = accentFor(item);
  const isMeal = item.type === 'meal';
  const totals = isMeal ? sumMealMacros(item.foods || []) : null;
  const empty = isMeal && (!item.foods || item.foods.length === 0);

  return (
    <div className="relative pl-11 pr-1 py-2.5" data-testid={`timeline-item-${item.id}`}>
      {/* node */}
      <div
        className="absolute left-[10px] top-4 w-4 h-4 rounded-full flex items-center justify-center"
        style={{ background: '#F7F7F5', border: `1.5px solid ${accent}` }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
      </div>

      <div className="rounded-2xl bg-white border border-[#E5E5E0] p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${accent}14`, color: accent }}
            >
              <Icon size={16} strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-[#2C332F] truncate">{item.title}</p>
              <button
                onClick={() => onEditTime && onEditTime(item)}
                data-testid={`edit-time-${item.id}`}
                className="mt-0.5 flex items-center gap-1 text-[11px] text-[#858C88]"
              >
                <Clock size={11} strokeWidth={1.5} />
                <span className="font-num">{item.time || '未设置'}</span>
              </button>
            </div>
          </div>

          {isMeal && totals && totals.cal > 0 && (
            <div className="text-right shrink-0">
              <p className="font-num text-sm font-medium text-[#2C332F]">
                {totals.cal} <span className="text-[10px] text-[#858C88] font-normal">kcal</span>
              </p>
              <p className="font-num text-[10px] text-[#858C88] mt-0.5">
                P{totals.p} · F{totals.f} · C{totals.c}
              </p>
            </div>
          )}

          {!isMeal && item.caloriesBurned && (
            <div className="text-right shrink-0">
              <p className="font-num text-sm font-medium" style={{ color: accent }}>
                -{item.caloriesBurned}
              </p>
              <p className="text-[10px] text-[#858C88]">kcal</p>
            </div>
          )}
        </div>

        {/* Meal foods */}
        {isMeal && !empty && (
          <div className="mt-3 divide-y divide-[#F0EFE9]">
            {item.foods.map((f, idx) => (
              <div key={idx} className="flex items-center justify-between py-2" data-testid={`food-row-${item.id}-${idx}`}>
                <div className="min-w-0">
                  <p className="text-[13px] text-[#2C332F] truncate">{f.name}</p>
                  <p className="font-num text-[11px] text-[#858C88] mt-0.5">
                    {f.grams}g · P{f.p} · F{f.f} · C{f.c}
                  </p>
                </div>
                <p className="font-num text-[13px] text-[#2C332F] shrink-0 ml-3">{f.cal} <span className="text-[10px] text-[#858C88]">kcal</span></p>
              </div>
            ))}
          </div>
        )}

        {isMeal && empty && (
          <p className="text-[12px] text-[#858C88] mt-2.5">还没有添加食物</p>
        )}

        {!isMeal && item.detail && (
          <p className="text-[12.5px] text-[#2C332F]/80 mt-2">{item.detail}</p>
        )}

        {isMeal && (
          <button
            onClick={() => onAddFood(item)}
            data-testid={`add-food-btn-${item.id}`}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-[12.5px] text-[#6B8067] py-2 rounded-xl border border-dashed border-[#6B8067]/40 hover:bg-[#6B8067]/5"
          >
            <Plus size={14} strokeWidth={1.8} />
            <span>添加食物</span>
          </button>
        )}
      </div>
    </div>
  );
};
