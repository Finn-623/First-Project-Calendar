import React from 'react';
import { UtensilsCrossed, Dumbbell, Footprints, MapPin, Plus, Clock, Trash2, Loader2 } from 'lucide-react';
import { sumMealMacros } from '../mockData';
import { SNACK_TYPE_LABELS, normalizeSnackType } from '../constants/snackTypes';
import { formatStrengthBodyPartsLabels } from '../constants/trainingBodyParts';
import { getLocalTimeInputValue } from '../lib/localDateTime';

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

export const TimelineItem = ({
  item,
  onAddFood,
  onEditTime,
  onDelete,
  onEnd,
  deleting = false,
  ending = false,
  readOnly = false,
  layout = 'default',
}) => {
  const Icon = iconFor(item);
  const accent = accentFor(item);
  const isMeal = item.type === 'meal';
  const totals = isMeal ? sumMealMacros(item.foods || []) : null;
  const empty = isMeal && (!item.foods || item.foods.length === 0);
  const timeLabel = item.time || '未设置';
  const snackType = item?.subtype === 'snack' ? normalizeSnackType(item?.snackType) : null;
  const mealTitle = snackType ? `${SNACK_TYPE_LABELS[snackType]}加餐` : item.title;
  const strengthBodyPartsText = item?.type === 'anaerobic'
    ? formatStrengthBodyPartsLabels(item?.bodyParts)
    : '';
  const isRunning = item?.status === 'running';
  const completedEndTime = item?.ended_at ? getLocalTimeInputValue(new Date(item.ended_at)) : '';
  const completedDuration = Number(item?.duration_minutes);
  const hasCompletedDuration = Number.isFinite(completedDuration) && completedDuration > 0;

  const canDelete = !readOnly && !isRunning && (
    item.subtype === 'snack'
    || item.type === 'anaerobic'
    || item.type === 'aerobic'
    || item.type === 'event'
  );

  const titleClass = layout === 'home-time-left'
    ? 'text-[13.5px] font-medium text-[#2C332F] break-words leading-5'
    : 'text-[13.5px] font-medium text-[#2C332F] truncate';

  const timeEditLabel = layout === 'home-time-left' ? '修改时间' : timeLabel;

  const cardContent = (
    <div className="rounded-2xl bg-white border border-[#E5E5E0] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}14`, color: accent }}
          >
            <Icon size={16} strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <p className={titleClass}>{mealTitle}</p>
            <button
              onClick={() => !readOnly && onEditTime && onEditTime(item)}
              data-testid={`edit-time-${item.id}`}
              disabled={readOnly || isRunning}
              className="mt-0.5 flex items-center gap-1 text-[11px] text-[#858C88]"
            >
              <Clock size={11} strokeWidth={1.5} />
              <span className="font-num">{timeEditLabel}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isMeal && totals && totals.cal > 0 && (
            <div className="text-right">
              <p className="font-num text-sm font-medium text-[#2C332F]">
                {totals.cal} <span className="text-[10px] text-[#858C88] font-normal">kcal</span>
              </p>
              <p className="font-num text-[10px] text-[#858C88] mt-0.5">
                P{totals.p} F{totals.f} C{totals.c}
              </p>
            </div>
          )}

          {canDelete && (
            <button
              onClick={() => onDelete && onDelete(item)}
              disabled={deleting}
              aria-label={`删除${item.title}`}
              data-testid={`delete-timeline-${item.id}`}
              className="w-9 h-9 rounded-xl border border-[#E5E5E0] text-[#858C88] hover:text-[#D27D67] hover:border-[#D27D67]/40 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            </button>
          )}
        </div>
      </div>

      {isMeal && (
        <div className="mt-3">
          {empty ? (
            <button
              onClick={() => !readOnly && onAddFood && onAddFood(item)}
              data-testid={`add-food-${item.id}`}
              disabled={readOnly}
              className="w-full h-10 rounded-xl border border-dashed border-[#D9DDD8] text-[#858C88] text-[12px] flex items-center justify-center gap-1.5 hover:border-[#6B8067]/40 hover:text-[#6B8067]"
            >
              <Plus size={14} strokeWidth={1.8} /> 添加食物
            </button>
          ) : (
            <div className="space-y-1.5" data-testid={`meal-foods-${item.id}`}>
              {(item.foods || []).map((f, i) => (
                <div key={`${f.foodId}-${i}`} className="flex items-center justify-between text-[12px] gap-2">
                  <div className="min-w-0">
                    <p className="text-[#2C332F] break-words">{f.name}</p>
                    <p className="font-num text-[#858C88]">{f.grams}g</p>
                  </div>
                  <p className="font-num text-[#2C332F] shrink-0">
                    {f.cal} <span className="text-[10px] text-[#858C88]">kcal</span>
                  </p>
                </div>
              ))}
              {!readOnly && (
                <button
                  onClick={() => onAddFood && onAddFood(item)}
                  className="mt-1 text-[12px] text-[#6B8067]"
                  data-testid={`add-more-food-${item.id}`}
                >
                  + 继续添加
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!isMeal && (
        <div className="mt-2.5">
          <p className="text-[12px] text-[#2C332F] break-words">{item.detail || '—'}</p>
          {strengthBodyPartsText ? (
            <p className="text-[12px] text-[#5E6660] mt-1">{strengthBodyPartsText}</p>
          ) : null}
          {isRunning ? (
            <p className="text-[12px] text-[#6B8067] mt-1">进行中</p>
          ) : null}
          {!isRunning && completedEndTime ? (
            <p className="font-num text-[11px] text-[#858C88] mt-1">结束时间 {completedEndTime}</p>
          ) : null}
          {!isRunning && hasCompletedDuration ? (
            <p className="font-num text-[11px] text-[#858C88] mt-1">时长 {completedDuration}分钟</p>
          ) : null}
          {typeof item.caloriesBurned === 'number' && (
            <p className="font-num text-[11px] text-[#858C88] mt-1">消耗 {item.caloriesBurned} kcal</p>
          )}
          {isRunning && onEnd ? (
            <button
              type="button"
              onClick={() => onEnd(item)}
              disabled={ending}
              data-testid={`end-timeline-${item.id}`}
              className="mt-2 h-9 px-3 rounded-xl border border-[#6B8067] text-[#6B8067] text-[12px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {ending ? '结束中...' : '结束'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );

  if (layout === 'home-time-left') {
    return (
      <div className="grid grid-cols-[56px_18px_minmax(0,1fr)] gap-2 py-2.5" data-testid={`timeline-item-${item.id}`}>
        <div className="font-num text-[12px] text-[#858C88] text-right leading-6 pt-1 whitespace-nowrap">
          {timeLabel}
        </div>

        <div className="pt-3.5 flex justify-center">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: '#F7F7F5', border: `1.5px solid ${accent}` }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
          </div>
        </div>

        <div className="min-w-0 pr-1">{cardContent}</div>
      </div>
    );
  }

  return (
    <div className="relative pl-11 pr-1 py-2.5" data-testid={`timeline-item-${item.id}`}>
      <div
        className="absolute left-[10px] top-4 w-4 h-4 rounded-full flex items-center justify-center"
        style={{ background: '#F7F7F5', border: `1.5px solid ${accent}` }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
      </div>

      {cardContent}
    </div>
  );
};
