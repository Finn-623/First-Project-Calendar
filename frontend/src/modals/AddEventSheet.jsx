import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { getLocalTimeInputValue } from '../lib/localDateTime';

export const AddEventSheet = ({ open, onOpenChange, onConfirm }) => {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (open) {
      setTime(getLocalTimeInputValue(new Date()));
    } else {
      setTitle('');
      setTime('');
      setDetail('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (!title.trim()) return;
    onConfirm({
      id: `e${Date.now()}`,
      type: 'event',
      title: title.trim(),
      time,
      detail: detail.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-[#E5E5E0] bg-[#F7F7F5] max-w-md mx-auto p-0"
        data-testid="add-event-sheet"
      >
        <SheetHeader className="px-5 pt-5 pb-3 text-left">
          <SheetTitle className="text-base font-medium text-[#2C332F]">添加其他事件</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-6 space-y-3">
          <div>
            <label className="text-[12px] text-[#858C88]">标题</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：会议 / 散步 / 睡眠"
              className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl"
              data-testid="event-title-input"
            />
          </div>

          <div>
            <label className="text-[12px] text-[#858C88]">时间</label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl font-num"
              data-testid="event-time-input"
            />
          </div>

          <div>
            <label className="text-[12px] text-[#858C88]">备注（可选）</label>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="写点什么…"
              rows={3}
              className="mt-1.5 bg-white border-[#E5E5E0] rounded-xl"
              data-testid="event-detail-input"
            />
          </div>

          <Button
            onClick={handleConfirm}
            data-testid="event-confirm-btn"
            className="w-full h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white text-[14px] mt-2"
          >
            确认添加
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
