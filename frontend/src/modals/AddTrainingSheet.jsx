import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Dumbbell, Footprints } from 'lucide-react';

export const AddTrainingSheet = ({ open, onOpenChange, onConfirm, initialKind = 'anaerobic' }) => {
  const [tab, setTab] = useState(initialKind);
  const [name, setName] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [time, setTime] = useState('18:00');
  const [submitting, setSubmitting] = useState(false);
  const [durationError, setDurationError] = useState('');

  useEffect(() => {
    if (!open) {
      setTab(initialKind);
      setName('');
      setDurationInput('');
      setTime('18:00');
      setSubmitting(false);
      setDurationError('');
    } else {
      setTab(initialKind);
    }
  }, [open, initialKind]);

  const parsedDuration = Number(durationInput.trim());
  const durationForEstimate = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 0;

  const estimate = tab === 'anaerobic'
    ? Math.round(durationForEstimate * 6.2)
    : Math.round(durationForEstimate * 9.5);

  const normalizeDurationOnBlur = () => {
    const normalizedInput = durationInput.trim();
    if (!normalizedInput) return;

    if (/^\d+$/.test(normalizedInput)) {
      setDurationInput(String(Number(normalizedInput)));
    }
  };

  const handleConfirm = async () => {
    if (submitting) return;

    const normalizedInput = durationInput.trim();

    if (!normalizedInput) {
      setDurationError('请输入训练时长');
      return;
    }

    if (!/^\d+$/.test(normalizedInput)) {
      setDurationError('请输入有效的训练时长');
      return;
    }

    const duration = Number(normalizedInput);

    if (!Number.isFinite(duration)) {
      setDurationError('请输入有效的训练时长');
      return;
    }

    if (duration <= 0) {
      setDurationError('训练时长必须大于 0 分钟');
      return;
    }

    const normalizedDuration = String(duration);

    const payload = {
      id: `t${Date.now()}`,
      type: tab,
      title: tab === 'anaerobic' ? '无氧训练' : '有氧训练',
      time,
      detail: `${name || (tab === 'anaerobic' ? '力量训练' : '有氧运动')} · ${normalizedDuration} 分钟`,
      caloriesBurned: estimate,
    };

    try {
      setSubmitting(true);
      setDurationError('');
      setDurationInput(normalizedDuration);
      await Promise.resolve(onConfirm(payload));
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
        data-testid="add-training-sheet"
      >
        <SheetHeader className="px-5 pt-5 pb-3 text-left">
          <SheetTitle className="text-base font-medium text-[#2C332F]">训练</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-2xl border border-[#E5E5E0]">
            {[
              { id: 'anaerobic', label: '无氧', icon: Dumbbell },
              { id: 'aerobic', label: '有氧', icon: Footprints },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                data-testid={`training-tab-${id}`}
                disabled={submitting}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] ${
                  tab === id ? 'bg-[#6B8067] text-white' : 'text-[#858C88]'
                }`}
              >
                <Icon size={14} strokeWidth={1.6} />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[12px] text-[#858C88]">项目名称</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tab === 'anaerobic' ? '例如：胸 + 三头' : '例如：跑步'}
                className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl text-base"
                data-testid="training-name-input"
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] text-[#858C88]">开始时间</label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl font-num text-base"
                  data-testid="training-time-input"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="text-[12px] text-[#858C88]">时长 (分钟)</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={durationInput}
                  onBlur={normalizeDurationOnBlur}
                  onChange={(e) => {
                    setDurationInput(e.target.value);
                    if (durationError) {
                      setDurationError('');
                    }
                  }}
                  placeholder="分钟"
                  className="mt-1.5 h-11 bg-white border-[#E5E5E0] rounded-xl font-num text-base"
                  data-testid="training-duration-input"
                  disabled={submitting}
                />
                {durationError ? (
                  <p className="mt-1 text-[12px] text-[#D27D67]">{durationError}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: '#FBEEE8' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#858C88]">预估消耗</p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="font-num text-3xl font-medium text-[#D27D67]" data-testid="training-preview-cal">
                  {estimate}
                </span>
                <span className="text-xs text-[#858C88]">kcal</span>
              </div>
            </div>

            <Button
              onClick={handleConfirm}
              data-testid="training-confirm-btn"
              disabled={submitting}
              className="w-full h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white text-[14px] mt-2"
            >
              {submitting ? '添加中...' : '确认添加'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
