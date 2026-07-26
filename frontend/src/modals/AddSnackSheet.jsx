import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { SNACK_TYPES, normalizeSnackType } from '../constants/snackTypes';
import { getLocalTimeInputValue } from '../lib/localDateTime';

export const AddSnackSheet = ({ open, onOpenChange, onConfirm }) => {
  const [time, setTime] = useState('');
  const [snackType, setSnackType] = useState('normal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTime(getLocalTimeInputValue(new Date()));
      setSnackType('normal');
      setSubmitting(false);
      setError('');
    }
  }, [open]);

  const handleConfirm = async () => {
    const nextTime = String(time || '').trim();
    if (!nextTime) {
      setError('请选择时间');
      return;
    }

    const nextType = normalizeSnackType(snackType);
    if (!nextType) {
      setError('请选择加餐类型');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await Promise.resolve(onConfirm({ time: nextTime, snackType: nextType }));
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-[#E5E5E0] bg-[#F7F7F5] max-w-md mx-auto p-0"
        data-testid="add-snack-sheet"
      >
        <SheetHeader className="px-5 pt-5 pb-3 text-left">
          <SheetTitle className="text-base font-medium text-[#2C332F]">新增加餐</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-6 space-y-4">
          <div>
            <label className="text-[12px] text-[#858C88]">时间</label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl font-num text-base"
              data-testid="snack-time-input"
            />
          </div>

          <div>
            <label className="text-[12px] text-[#858C88]">类型</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {SNACK_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSnackType(item.value)}
                  data-testid={`snack-type-${item.value}`}
                  className={`h-10 rounded-xl border text-[13px] ${
                    snackType === item.value
                      ? 'bg-[#6B8067] border-[#6B8067] text-white'
                      : 'bg-white border-[#E5E5E0] text-[#5E6660]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-[12px] text-[#D27D67]">{error}</p> : null}

          <div className="rounded-2xl border border-dashed border-[#D9DDD8] bg-white p-4">
            <p className="text-[12px] text-[#2C332F]">创建加餐后可继续添加食物和克重，原有流程保持不变。</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              className="flex-1 bg-[#6B8067] hover:bg-[#5a6d57]"
              onClick={handleConfirm}
              disabled={submitting}
              data-testid="snack-confirm-btn"
            >
              {submitting ? '添加中...' : '确认添加'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
