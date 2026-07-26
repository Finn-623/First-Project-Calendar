import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Dumbbell, Footprints } from 'lucide-react';
import { STRENGTH_BODY_PART_OPTIONS, normalizeStrengthBodyParts } from '../constants/trainingBodyParts';

export const AddTrainingSheet = ({ open, onOpenChange, onConfirm, initialKind = 'anaerobic' }) => {
  const [tab, setTab] = useState(initialKind);
  const [name, setName] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [time, setTime] = useState('18:00');
  const [submitting, setSubmitting] = useState(false);
  const [durationError, setDurationError] = useState('');
  const [selectedBodyParts, setSelectedBodyParts] = useState([]);
  const [bodyPartError, setBodyPartError] = useState('');

  useEffect(() => {
    if (!open) {
      setTab(initialKind);
      setName('');
      setDurationInput('');
      setTime('18:00');
      setSubmitting(false);
      setDurationError('');
      setSelectedBodyParts([]);
      setBodyPartError('');
    } else {
      setTab(initialKind);
    }
  }, [open, initialKind]);

  const toggleBodyPart = (bodyPart) => {
    setSelectedBodyParts((current) => {
      if (current.includes(bodyPart)) {
        return current.filter((item) => item !== bodyPart);
      }

      return [...current, bodyPart];
    });

    if (bodyPartError) {
      setBodyPartError('');
    }
  };

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    if (bodyPartError) {
      setBodyPartError('');
    }
  };

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
    const normalizedBodyParts = normalizeStrengthBodyParts(selectedBodyParts);

    if (tab === 'anaerobic' && normalizedBodyParts.length === 0) {
      setBodyPartError('请选择至少一个训练部位');
      return;
    }

    const payload = {
      id: `t${Date.now()}`,
      type: tab,
      title: tab === 'anaerobic' ? '无氧训练' : '有氧训练',
      time,
      detail: `${name || (tab === 'anaerobic' ? '力量训练' : '有氧运动')} · ${normalizedDuration} 分钟`,
      bodyParts: tab === 'anaerobic' ? normalizedBodyParts : undefined,
    };

    try {
      setSubmitting(true);
      setDurationError('');
      setBodyPartError('');
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
        className="rounded-t-3xl border-[#E5E5E0] bg-[#F7F7F5] w-[calc(100vw-32px)] max-w-md max-h-[calc(100dvh-24px)] mx-auto p-0 flex flex-col overflow-hidden"
        data-testid="add-training-sheet"
      >
        <SheetHeader className="px-5 pt-5 pb-3 text-left shrink-0">
          <SheetTitle className="text-base font-medium text-[#2C332F]">训练</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-6 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-2xl border border-[#E5E5E0]">
            {[
              { id: 'anaerobic', label: '无氧', icon: Dumbbell },
              { id: 'aerobic', label: '有氧', icon: Footprints },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            {tab === 'anaerobic' ? (
              <div>
                <label className="text-[12px] text-[#858C88]">训练部位</label>
                <div className="mt-1.5 grid grid-cols-4 gap-2" data-testid="training-body-part-group">
                  {STRENGTH_BODY_PART_OPTIONS.map((option) => {
                    const selected = selectedBodyParts.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleBodyPart(option.value)}
                        disabled={submitting}
                        data-testid={`training-body-part-${option.value}`}
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
                {bodyPartError ? (
                  <p className="mt-1 text-[12px] text-[#D27D67]">{bodyPartError}</p>
                ) : null}
              </div>
            ) : null}

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
