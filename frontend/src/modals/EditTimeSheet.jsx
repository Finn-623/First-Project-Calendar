import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { getLocalTimeInputValue } from '../lib/localDateTime';

export const EditTimeSheet = ({ open, onOpenChange, item, onConfirm }) => {
  const [time, setTime] = useState('12:00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && item) {
      setTime(item.time || '12:00');
      setSubmitting(false);
      setError('');
    }
  }, [open, item]);

  const isValidTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  const handleConfirm = async () => {
    if (submitting || !isValidTime) {
      if (!isValidTime) setError('请输入有效的 24 小时时间');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onConfirm(time);
      onOpenChange(false);
    } catch (confirmError) {
      setError(confirmError?.message || '时间保存失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-[#E5E5E0] bg-[#F7F7F5] max-w-md mx-auto p-0"
        data-testid="edit-time-sheet"
      >
        <SheetHeader className="px-5 pt-5 pb-3 text-left">
          <SheetTitle className="text-base font-medium text-[#2C332F]">
            设置 {item?.title} 时间
          </SheetTitle>
        </SheetHeader>
        <div className="px-5 pb-6">
          <Input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setError('');
            }}
            disabled={submitting}
            aria-invalid={Boolean(error)}
            className="h-14 text-2xl font-num bg-white border-[#E5E5E0] rounded-xl"
            data-testid="edit-time-input"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTime(getLocalTimeInputValue(new Date()));
              setError('');
            }}
            disabled={submitting}
            data-testid="edit-time-use-now"
            className="mt-2 min-h-11 w-full rounded-xl border-[#D9DDD8] bg-white text-[#5E6660]"
          >
            使用现在时间
          </Button>
          {error ? <p role="alert" className="mt-2 text-sm text-[#B85C4A]">{error}</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              data-testid="edit-time-cancel"
              className="h-12 rounded-2xl"
            >
              取消
            </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || !isValidTime}
            data-testid="edit-time-confirm"
            className="h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white"
          >
            {submitting ? '保存中...' : '保存'}
          </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
