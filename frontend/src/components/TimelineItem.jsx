import React from 'react';
import { UtensilsCrossed, Dumbbell, Footprints, MapPin, Plus, Clock, Trash2, Loader2, RotateCcw } from 'lucide-react';
import { sumMealMacros } from '../mockData';
import { SNACK_TYPE_LABELS, normalizeSnackType } from '../constants/snackTypes';
import { getStrengthBodyPartLabels } from '../constants/trainingBodyParts';
import { formatClockTime, formatDuration, resolveDurationSeconds, diffSecondsBetween } from '../lib/localDateTime';

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
  onDeleteFood,
  onRetryFoodSync,
  onEditTime,
  onEditRecord,
  onDelete,
  onEnd,
  deleting = false,
  ending = false,
  deletingFoodEntryKey = null,
  readOnly = false,
  now,
  layout = 'default',
  allowMealDelete = false,
}) => {
  const Icon = iconFor(item);
  const accent = accentFor(item);
  const isMeal = item.type === 'meal';
  const isFixedMeal = isMeal && ['breakfast', 'lunch', 'dinner'].includes(item.subtype);
  const totals = isMeal ? sumMealMacros(item.foods || []) : null;
  const empty = isMeal && (!item.foods || item.foods.length === 0);
  const timeLabel = formatClockTime(item.time || item.started_at) || '未设置';
  const snackType = item?.subtype === 'snack' ? normalizeSnackType(item?.snackType) : null;
  const mealTitle = snackType ? `${SNACK_TYPE_LABELS[snackType]}加餐` : item.title;
  const activityTitle = item?.type === 'aerobic'
    ? (String(item?.details?.name || '').trim() || item.title)
    : item.title;
  const activityNote = typeof item?.notes === 'string' ? item.notes.trim() : '';
  const strengthBodyPartLabels = item?.type === 'anaerobic' ? getStrengthBodyPartLabels(item?.bodyParts) : [];
  const isRunning = item?.status === 'running';
  const completedEndTime = formatClockTime(item?.ended_at);

  const fixedDurationSeconds = resolveDurationSeconds({
    startedAt: item?.started_at,
    endedAt: item?.ended_at,
    durationMinutes: item?.duration_minutes,
  });

  const elapsedDurationSeconds = isRunning && item?.started_at && now
    ? diffSecondsBetween(new Date(item.started_at), now)
    : null;

  const canEdit = !readOnly && (
    (isMeal && !isFixedMeal && Boolean(onEditTime))
    || (!isMeal && Boolean(onEditRecord))
  );

  const canDelete = !readOnly && !isRunning && Boolean(onDelete) && (
    !isMeal || allowMealDelete
  );

  const titleClass = layout === 'home-time-left'
    ? 'text-[13.5px] font-medium text-[#2C332F] break-words leading-5'
    : 'text-[13.5px] font-medium text-[#2C332F] truncate';

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
            <p className={titleClass}>{isMeal ? mealTitle : activityTitle}</p>
            {isFixedMeal && !readOnly && onEditTime ? (
              <button
                type="button"
                onClick={() => onEditTime(item)}
                aria-label={`修改${item.title}时间，当前${timeLabel}`}
                className="mt-0.5 flex min-h-6 items-center gap-1 text-[11px] text-[#858C88] hover:text-[#6B8067]"
              >
                <Clock size={11} strokeWidth={1.5} />
                <span className="font-num">{timeLabel}</span>
              </button>
            ) : isMeal ? (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#858C88]">
                <Clock size={11} strokeWidth={1.5} />
                <span className="font-num">{timeLabel}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-[#858C88]">{item?.type === 'aerobic' ? '有氧训练' : '记录'}</p>
            )}
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

          {canEdit ? (
            <button
              type="button"
              onClick={() => {
                if (isMeal) {
                  onEditTime && onEditTime(item);
                } else {
                  onEditRecord && onEditRecord(item);
                }
              }}
              aria-label={`编辑${item.title}`}
              data-testid={isMeal ? `edit-time-${item.id}` : `edit-record-${item.id}`}
              className="h-8 px-2.5 rounded-lg border border-[#E5E5E0] text-[#5E6660] text-[12px]"
            >
              编辑
            </button>
          ) : null}

          {canDelete ? (
            <button
              type="button"
              onClick={() => onDelete && onDelete(item)}
              disabled={deleting}
              aria-label={`删除${item.title}`}
              data-testid={`delete-timeline-${item.id}`}
              className="h-8 px-2.5 rounded-lg border border-[#E5E5E0] text-[#858C88] hover:text-[#D27D67] hover:border-[#D27D67]/40 disabled:opacity-60 disabled:cursor-not-allowed text-[12px] flex items-center gap-1"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={13} />}
              删除
            </button>
          ) : null}
        </div>
      </div>

      {isMeal ? (
        <div className="mt-3">
          {empty ? (
            <button
              type="button"
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
                    {f.sync_status === 'pending' || f.sync_status === 'syncing' ? (
                      <p className="text-[10px] text-[#858C88]">同步中…</p>
                    ) : null}
                    {f.sync_status === 'failed' ? (
                      <button
                        type="button"
                        onClick={() => onRetryFoodSync && onRetryFoodSync(item, f)}
                        className="mt-1 inline-flex min-h-8 items-center gap-1 text-[11px] text-[#D27D67]"
                        aria-label={`重试同步${f.name}`}
                      >
                        <RotateCcw size={12} /> 同步失败，重试
                      </button>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-num text-[#2C332F]">
                      {f.cal} <span className="text-[10px] text-[#858C88]">kcal</span>
                    </p>

                    {!readOnly && onDeleteFood ? (
                      <button
                        type="button"
                        onClick={() => onDeleteFood(item, f, i)}
                        disabled={deleting || deletingFoodEntryKey === (f?.entryId || f?.id || f?.foodEntryId || `legacy-${i}-${f?.foodId || f?.name || 'food'}`)}
                        aria-label={`删除${item.title}中的${f.name}`}
                        data-testid={`delete-food-entry-${item.id}-${i}`}
                        className="h-10 w-10 rounded-xl border border-[#E5E5E0] text-[#858C88] hover:text-[#D27D67] hover:border-[#D27D67]/40 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deletingFoodEntryKey === (f?.entryId || f?.id || f?.foodEntryId || `legacy-${i}-${f?.foodId || f?.name || 'food'}`)
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => onAddFood && onAddFood(item)}
                  className="mt-1 text-[12px] text-[#6B8067]"
                  data-testid={`add-more-food-${item.id}`}
                >
                  + 继续添加
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2.5">
          {activityNote ? <p className="text-[12px] text-[#2C332F] break-words">{activityNote}</p> : null}
          {strengthBodyPartLabels.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid={`training-body-part-badges-${item.id}`}>
              {strengthBodyPartLabels.map((label) => (
                <span
                  key={label}
                  className="px-2 py-0.5 rounded-full bg-[#F0F4EF] border border-[#D7E8E0] text-[11px] text-[#4B5E55]"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          {isRunning ? <p className="text-[12px] text-[#6B8067] mt-1">进行中</p> : null}
          {isRunning && elapsedDurationSeconds != null ? (
            <p className="font-num tabular-nums text-[12px] text-[#2C332F] mt-1">已进行 {formatDuration(elapsedDurationSeconds)}</p>
          ) : null}
          {!isRunning && completedEndTime ? <p className="font-num text-[11px] text-[#858C88] mt-1">结束 {completedEndTime}</p> : null}
          {!isRunning && fixedDurationSeconds != null ? (
            <p className="font-num tabular-nums text-[11px] text-[#858C88] mt-1">时长 {formatDuration(fixedDurationSeconds)}</p>
          ) : null}
          {typeof item.caloriesBurned === 'number' ? (
            <p className="font-num text-[11px] text-[#858C88] mt-1">消耗 {item.caloriesBurned} kcal</p>
          ) : null}

          {isRunning && onEnd ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onEnd(item)}
                disabled={ending}
                data-testid={`end-timeline-${item.id}`}
                className="h-9 px-3 rounded-xl border border-[#6B8067] text-[#6B8067] text-[12px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {ending ? '结束中...' : '结束'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  if (layout === 'home-time-left') {
    return (
      <div className="grid grid-cols-[56px_18px_minmax(0,1fr)] gap-2 py-2.5" data-testid={`timeline-item-${item.id}`}>
        {isFixedMeal && !readOnly && onEditTime ? (
          <button
            type="button"
            onClick={() => onEditTime(item)}
            aria-label={`修改${item.title}时间，当前${timeLabel}`}
            data-testid={`meal-time-trigger-${item.id}`}
            className="min-h-11 self-start font-num text-[12px] text-[#858C88] hover:text-[#6B8067] text-right leading-6 whitespace-nowrap"
          >
            {timeLabel}
          </button>
        ) : (
          <div className="font-num text-[12px] text-[#858C88] text-right leading-6 pt-1 whitespace-nowrap">
            {timeLabel}
          </div>
        )}

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
