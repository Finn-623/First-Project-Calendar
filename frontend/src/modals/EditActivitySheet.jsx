import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { STRENGTH_BODY_PART_OPTIONS, normalizeStrengthBodyParts } from '../constants/trainingBodyParts';
import { formatClockTime, formatTimeInputWithSeconds } from '../lib/localDateTime';

const toDateInput = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const next = new Date(value);
  if (Number.isNaN(next.getTime())) return '';
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeText = (value) => (typeof value === 'string' ? value : '').trim();
const isAerobic = (item) => item?.type === 'aerobic';
const isAnaerobic = (item) => item?.type === 'anaerobic';
const isTrainingItem = (item) => isAnaerobic(item) || isAerobic(item);

const resolveAerobicProjectName = (item) => {
  const detailsName = normalizeText(item?.details?.name);
  if (detailsName) return detailsName;

  const title = normalizeText(item?.title);
  if (title && title !== '有氧训练' && title !== '无氧训练') {
    return title;
  }

  return '';
};

export const EditActivitySheet = ({ open, onOpenChange, item, onConfirm }) => {
  const [tab, setTab] = useState('event');
  const [eventTitle, setEventTitle] = useState('');
  const [aerobicProjectName, setAerobicProjectName] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedBodyParts, setSelectedBodyParts] = useState([]);
  const [nameError, setNameError] = useState('');
  const [bodyPartError, setBodyPartError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const initialRef = useRef(null);

  const running = item?.status === 'running';

  useEffect(() => {
    if (!open || !item) {
      initialRef.current = null;
      setSubmitting(false);
      return;
    }

    const nextTab = isAnaerobic(item) ? 'anaerobic' : isAerobic(item) ? 'aerobic' : 'event';
    const nextEventTitle = normalizeText(item?.title);
    const nextAerobicProjectName = isAerobic(item) ? resolveAerobicProjectName(item) : '';
    const nextNote = normalizeText(item?.notes);
    const nextDate = toDateInput(item?.event_date);
    const nextStartTime = formatTimeInputWithSeconds(item?.started_at || item?.time);
    const nextEndTime = formatTimeInputWithSeconds(item?.ended_at);
    const nextBodyParts = normalizeStrengthBodyParts(item?.bodyParts || item?.details?.bodyParts);

    setTab(nextTab);
    setEventTitle(nextEventTitle);
    setAerobicProjectName(nextAerobicProjectName);
    setNote(nextNote);
    setDate(nextDate);
    setStartTime(nextStartTime);
    setEndTime(nextEndTime);
    setSelectedBodyParts(nextBodyParts);
    setNameError('');
    setBodyPartError('');
    setTimeError('');
    setSubmitting(false);

    initialRef.current = {
      tab: nextTab,
      eventTitle: nextEventTitle,
      aerobicProjectName: nextAerobicProjectName,
      note: nextNote,
      bodyParts: nextBodyParts,
      date: nextDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
    };
  }, [open, item]);

  const title = useMemo(() => {
    if (tab === 'anaerobic') return '编辑无氧训练';
    if (tab === 'aerobic') return '编辑有氧训练';
    return '编辑事件';
  }, [tab]);

  const toggleBodyPart = (value) => {
    setSelectedBodyParts((prev) => {
      if (prev.includes(value)) return prev.filter((itemValue) => itemValue !== value);
      return [...prev, value];
    });
    if (bodyPartError) setBodyPartError('');
  };

  const handleConfirm = async () => {
    if (!item) return;

    const nextEventTitle = eventTitle.trim();
    const nextAerobicProjectName = aerobicProjectName.trim();
    const nextNote = note.trim();
    const normalizedBodyParts = normalizeStrengthBodyParts(selectedBodyParts);

    if (tab === 'aerobic' && !nextAerobicProjectName) {
      setNameError('请输入有氧项目名称');
      return;
    }

    if (tab === 'anaerobic' && normalizedBodyParts.length === 0) {
      setBodyPartError('请选择至少一个训练部位');
      return;
    }

    if (!running && (!date || !startTime)) {
      setTimeError('请填写完整的开始日期和开始时间');
      return;
    }

    const nextType = tab === 'anaerobic' ? 'anaerobic_training' : tab === 'aerobic' ? 'aerobic_training' : 'other';
    const nextTitle = tab === 'anaerobic' ? '无氧训练' : tab === 'aerobic' ? nextAerobicProjectName : nextEventTitle;

    const nextDetails = {
      ...(item?.details || {}),
      tab,
      name: tab === 'aerobic' ? nextAerobicProjectName : '',
      bodyParts: tab === 'anaerobic' ? normalizedBodyParts : [],
    };

    const initial = initialRef.current || {};
    const changedDate = date !== initial.date;
    const changedStart = startTime !== initial.startTime;
    const changedEnd = endTime !== initial.endTime;
    const changedType = nextType !== item?.item_type;
    const changedTitle = nextTitle !== (item?.title || '');
    const changedNotes = (nextNote || null) !== (item?.notes || null);
    const changedDetails = JSON.stringify(nextDetails) !== JSON.stringify(item?.details || {});

    const updates = {};

    if (changedType) {
      updates.item_type = nextType;
    }

    if (changedTitle) {
      updates.title = nextTitle || item?.title;
    }

    if (changedNotes) {
      updates.notes = nextNote || null;
    }

    if (changedDetails) {
      updates.details = nextDetails;
    }

    if (!running && changedDate) {
      updates.event_date = date;
    }

    if (!running && changedStart) {
      updates.event_time = formatClockTime(startTime);
    }

    if (!running) {
      if ((changedDate || changedStart) && date && startTime) {
        const nextStart = new Date(`${date}T${startTime}`);
        if (!Number.isNaN(nextStart.getTime())) {
          updates.started_at = nextStart.toISOString();
        }
      }

      if (endTime) {
        const baseDate = date || item?.event_date;
        const startBase = updates.started_at || item?.started_at;
        const startDate = startBase ? new Date(startBase) : null;
        let nextEnd = new Date(`${baseDate}T${endTime}`);

        if (startDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(nextEnd.getTime()) && nextEnd.getTime() < startDate.getTime()) {
          nextEnd = new Date(nextEnd.getTime() + 24 * 60 * 60 * 1000);
        }

        if (!Number.isNaN(nextEnd.getTime())) {
          updates.ended_at = nextEnd.toISOString();
        }
      } else if (changedEnd) {
        updates.ended_at = null;
      }
    }

    if (!Object.keys(updates).length) {
      onOpenChange(false);
      return;
    }

    try {
      setSubmitting(true);
      setNameError('');
      setBodyPartError('');
      setTimeError('');
      await Promise.resolve(onConfirm(item, updates));
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-[#E5E5E0] bg-[#F7F7F5] w-[calc(100vw-32px)] max-w-md max-h-[calc(100dvh-24px)] mx-auto p-0 flex flex-col overflow-hidden"
        data-testid="edit-activity-sheet"
      >
        <SheetHeader className="px-5 pt-5 pb-3 text-left shrink-0">
          <SheetTitle className="text-base font-medium text-[#2C332F]">{title}</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-6 min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-3">
          {isTrainingItem(item) ? (
            <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-2xl border border-[#E5E5E0]" data-testid="edit-training-type-toggle">
              <button
                type="button"
                className={`py-2.5 rounded-xl text-[13px] ${tab === 'anaerobic' ? 'bg-[#6B8067] text-white' : 'text-[#858C88]'}`}
                onClick={() => {
                  setTab('anaerobic');
                  if (nameError) setNameError('');
                  if (bodyPartError) setBodyPartError('');
                }}
                disabled={submitting}
              >
                无氧
              </button>
              <button
                type="button"
                className={`py-2.5 rounded-xl text-[13px] ${tab === 'aerobic' ? 'bg-[#6B8067] text-white' : 'text-[#858C88]'}`}
                onClick={() => {
                  setTab('aerobic');
                  if (nameError) setNameError('');
                  if (bodyPartError) setBodyPartError('');
                }}
                disabled={submitting}
              >
                有氧
              </button>
            </div>
          ) : null}

          {tab === 'event' ? (
            <div>
              <label className="text-[12px] text-[#858C88]">事件名称</label>
              <Input
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl text-base"
                data-testid="edit-activity-name-input"
                disabled={submitting}
              />
            </div>
          ) : null}

          {tab === 'aerobic' ? (
            <div>
              <label className="text-[12px] text-[#858C88]">项目名称</label>
              <Input
                value={aerobicProjectName}
                onChange={(e) => {
                  setAerobicProjectName(e.target.value);
                  if (nameError) setNameError('');
                }}
                className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl text-base"
                data-testid="edit-training-aerobic-name-input"
                disabled={submitting}
              />
              {nameError ? <p className="mt-1 text-[12px] text-[#D27D67]">{nameError}</p> : null}
            </div>
          ) : null}

          {tab === 'anaerobic' ? (
            <div>
              <label className="text-[12px] text-[#858C88]">训练部位</label>
              <div className="mt-1.5 grid grid-cols-4 gap-2" data-testid="edit-training-body-part-group">
                {STRENGTH_BODY_PART_OPTIONS.map((option) => {
                  const selected = selectedBodyParts.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleBodyPart(option.value)}
                      disabled={submitting}
                      className={`h-10 rounded-xl border text-[13px] ${
                        selected
                          ? 'bg-[#6B8067] border-[#6B8067] text-white'
                          : 'bg-white border-[#E5E5E0] text-[#5E6660]'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {bodyPartError ? <p className="mt-1 text-[12px] text-[#D27D67]">{bodyPartError}</p> : null}
            </div>
          ) : null}

          <div>
            <label className="text-[12px] text-[#858C88]">备注（可选）</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1.5 bg-white border-[#E5E5E0] rounded-xl"
              data-testid="edit-activity-note-input"
              disabled={submitting}
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[12px] text-[#858C88]">日期</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl"
                data-testid="edit-activity-date-input"
                disabled={running || submitting}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[12px] text-[#858C88]">开始时间</label>
                <Input
                  type="time"
                  step="1"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl font-num text-base"
                  data-testid="edit-activity-start-time-input"
                  disabled={running || submitting}
                />
              </div>
              <div>
                <label className="text-[12px] text-[#858C88]">结束时间</label>
                <Input
                  type="time"
                  step="1"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl font-num text-base"
                  data-testid="edit-activity-end-time-input"
                  disabled={running || submitting}
                />
              </div>
            </div>

            {running ? (
              <p className="text-[12px] text-[#D27D67]">进行中记录不允许修改开始/结束时间。</p>
            ) : null}

            {timeError ? <p className="text-[12px] text-[#D27D67]">{timeError}</p> : null}
          </div>

          <Button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white text-[14px] mt-2"
            data-testid="edit-activity-confirm-btn"
          >
            {submitting ? '保存中...' : '保存修改'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
