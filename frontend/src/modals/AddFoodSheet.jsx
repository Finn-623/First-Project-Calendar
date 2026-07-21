import React, { useMemo, useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Search } from 'lucide-react';
import { FOOD_LIBRARY, scale } from '../mockData';

export const AddFoodSheet = ({ open, onOpenChange, targetTitle, onConfirm }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [grams, setGrams] = useState(100);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected(null);
      setGrams(100);
    }
  }, [open]);

  const list = useMemo(
    () => FOOD_LIBRARY.filter((f) => f.name.includes(query.trim())),
    [query]
  );

  const preview = selected ? scale(selected, Number(grams) || 0) : null;

  const handleConfirm = () => {
    if (!selected) return;
    const macros = scale(selected, Number(grams) || 0);
    onConfirm({
      foodId: selected.id,
      name: selected.name,
      grams: Number(grams) || 0,
      ...macros,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-[#E5E5E0] bg-[#F7F7F5] max-w-md mx-auto p-0 h-[86vh]"
        data-testid="add-food-sheet"
      >
        <div className="flex flex-col h-full">
          <SheetHeader className="px-5 pt-5 pb-3 text-left">
            <SheetTitle className="text-base font-medium text-[#2C332F]">
              添加食物 · <span className="text-[#858C88] text-sm">{targetTitle}</span>
            </SheetTitle>
          </SheetHeader>

          {!selected && (
            <>
              <div className="px-5 pb-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858C88]" strokeWidth={1.5} />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索食物名称"
                    className="pl-9 h-11 bg-white border-[#E5E5E0] rounded-xl"
                    data-testid="food-search-input"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-4">
                <div className="space-y-2">
                  {list.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelected(f)}
                      data-testid={`food-select-${f.id}`}
                      className="w-full text-left rounded-2xl bg-white border border-[#E5E5E0] p-3.5 flex items-center justify-between hover:border-[#6B8067]/40"
                    >
                      <div>
                        <p className="text-[13.5px] text-[#2C332F]">{f.name}</p>
                        <p className="font-num text-[11px] text-[#858C88] mt-0.5">
                          每100g · P{f.p100} F{f.f100} C{f.c100}
                        </p>
                      </div>
                      <p className="font-num text-sm text-[#2C332F]">
                        {f.cal100} <span className="text-[10px] text-[#858C88]">kcal</span>
                      </p>
                    </button>
                  ))}
                  {list.length === 0 && (
                    <p className="text-center text-sm text-[#858C88] py-8">没有找到相关食物</p>
                  )}
                </div>
              </div>
            </>
          )}

          {selected && (
            <div className="flex-1 flex flex-col px-5 pb-6">
              <div className="rounded-2xl bg-white border border-[#E5E5E0] p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[15px] font-medium text-[#2C332F]">{selected.name}</p>
                  <button
                    onClick={() => setSelected(null)}
                    data-testid="food-back-btn"
                    className="text-[12px] text-[#858C88]"
                  >
                    重新选择
                  </button>
                </div>
                <p className="font-num text-[11px] text-[#858C88] mt-1">
                  每100g · {selected.cal100} kcal · P{selected.p100} F{selected.f100} C{selected.c100}
                </p>
              </div>

              <div className="mt-4">
                <label className="text-[12px] text-[#858C88]">重量 (g)</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="mt-1.5 h-14 text-2xl font-num bg-white border-[#E5E5E0] rounded-xl"
                  data-testid="food-grams-input"
                />
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[50, 100, 150, 200].map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrams(g)}
                      data-testid={`grams-preset-${g}`}
                      className="px-3 py-1 rounded-full bg-white border border-[#E5E5E0] text-[12px] text-[#2C332F]"
                    >
                      {g}g
                    </button>
                  ))}
                </div>
              </div>

              {preview && (
                <div className="mt-5 rounded-2xl p-4 bg-[#6B8067]/6" style={{ background: '#EFF2ED' }}>
                  <p className="text-[11px] uppercase tracking-widest text-[#858C88]">计算结果</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="font-num text-3xl font-medium text-[#2C332F]" data-testid="food-preview-cal">{preview.cal}</span>
                    <span className="text-xs text-[#858C88]">kcal</span>
                  </div>
                  <p className="font-num text-[12px] text-[#2C332F]/80 mt-1">
                    蛋白 <b>{preview.p}g</b> · 脂肪 <b>{preview.f}g</b> · 碳水 <b>{preview.c}g</b>
                  </p>
                </div>
              )}

              <div className="mt-auto pt-6">
                <Button
                  onClick={handleConfirm}
                  data-testid="food-confirm-btn"
                  className="w-full h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white text-[14px]"
                >
                  确认添加
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
