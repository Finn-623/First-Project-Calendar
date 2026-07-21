import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export const EditTimeSheet = ({ open, onOpenChange, item, onConfirm }) => {
  const [time, setTime] = useState('12:00');

  useEffect(() => {
    if (open && item) setTime(item.time || '12:00');
  }, [open, item]);

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
            onChange={(e) => setTime(e.target.value)}
            className="h-14 text-2xl font-num bg-white border-[#E5E5E0] rounded-xl"
            data-testid="edit-time-input"
          />
          <Button
            onClick={() => { onConfirm(time); onOpenChange(false); }}
            data-testid="edit-time-confirm"
            className="w-full h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white mt-4"
          >
            保存
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
