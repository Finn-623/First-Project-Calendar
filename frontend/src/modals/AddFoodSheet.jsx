import React, { useMemo, useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Search } from 'lucide-react';
import { useStore } from '../store';

const scale = (food, grams) => {
  const k = (Number(grams) || 0) / 100;
  return {
    cal: Math.round((food.cal100 || 0) * k),
    p: +(((food.p100 || 0) * k).toFixed(1)),
    f: +(((food.f100 || 0) * k).toFixed(1)),
    c: +(((food.c100 || 0) * k).toFixed(1)),
  };
};

export const AddFoodSheet = ({ open, onOpenChange, targetTitle, onConfirm }) => {
  const { foods, user, refreshFoods } = useStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedPortion, setSelectedPortion] = useState(null);
  const [grams, setGrams] = useState(100);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected(null);
      setSelectedPortion(null);
      setGrams(100);
      setLoadingFoods(false);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    let disposed = false;

    const loadFoodsOnOpen = async () => {
      if (!open || !user?.id) return;

      setLoadingFoods(true);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (disposed) return;

        const { data } = await refreshFoods(user.id);
        const currentFoods = data || [];
        const hasPrivateFoods = currentFoods.some(
          (item) => item?.user_id === user.id && item?.visibility !== 'public'
        );

        // If private foods are present, we are done. If only public foods are
        // present, retry briefly to avoid a false-empty private list right after
        // account switch/login.
        if (hasPrivateFoods || attempt === 4) {
          break;
        }

        await wait(120 * (attempt + 1));
      }

      if (!disposed) {
        setLoadingFoods(false);
      }
    };

    loadFoodsOnOpen().catch(() => {
      if (!disposed) setLoadingFoods(false);
    });

    return () => {
      disposed = true;
    };
  }, [open, refreshFoods, user?.id]);

  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visible = (foods || []).filter((food) => {
      if (food?.is_active === false || food?.isActive === false) return false;
      if (food?.visibility !== 'public' && food?.user_id !== user?.id) return false;
      if (!normalizedQuery) return true;
      return [food.name, food.brand, food.nameEn, food.name_en].filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    }).sort((left, right) => {
      const leftPrivate = left.visibility !== 'public' ? 0 : 1;
      const rightPrivate = right.visibility !== 'public' ? 0 : 1;
      if (leftPrivate !== rightPrivate) return leftPrivate - rightPrivate;
      return String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN');
    });

    return {
      personal: visible.filter((food) => food.visibility !== 'public'),
      public: visible.filter((food) => food.visibility === 'public'),
    };
  }, [foods, query, user?.id]);

  const preview = selected ? scale(selected, Number(grams) || 0) : null;

  const selectFood = (food) => {
    const defaultPortion = food.visibility !== 'public'
      ? (food.portions || []).find((portion) => portion.isDefault)
      : null;
    setSelected(food);
    setSelectedPortion(defaultPortion || null);
    setGrams(defaultPortion?.grams || 100);
  };

  const selectPortion = (portion) => {
    setSelectedPortion(portion);
    setGrams(portion.grams);
  };

  const handleConfirm = () => {
    if (!selected || submitting) return;
    const macros = scale(selected, Number(grams) || 0);
    setSubmitting(true);
    try {
      const saved = onConfirm({
        foodId: selected.id,
        name: selected.name,
        grams: Number(grams) || 0,
        ...macros,
      });
      if (saved && typeof saved.then === 'function') {
        saved.then((result) => {
          if (result !== false) onOpenChange(false);
        }).finally(() => setSubmitting(false));
        return;
      }
      if (saved !== false) onOpenChange(false);
      setSubmitting(false);
    } catch (error) {
      setSubmitting(false);
      throw error;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-[#E5E5E0] bg-[#F7F7F5] max-w-md mx-auto p-0 h-[86dvh] max-h-[calc(100dvh-16px)] overflow-hidden data-[state=closed]:duration-0 data-[state=closed]:animate-none"
        overlayClassName="data-[state=closed]:duration-0 data-[state=closed]:animate-none"
        data-testid="add-food-sheet"
      >
        <div className="flex flex-col h-full">
          <SheetHeader className="px-5 pt-5 pb-3 text-left">
            <SheetTitle className="text-base font-medium text-[#2C332F]">
              添加食物 · <span className="text-[#858C88] text-sm">{targetTitle}</span>
            </SheetTitle>
            <SheetDescription className="sr-only">
              搜索并选择食物，输入克重后添加到当前餐次。
            </SheetDescription>
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
                  {loadingFoods && (
                    <p className="text-center text-sm text-[#858C88] py-8">正在加载食物库...</p>
                  )}

                  {!loadingFoods && [
                    ['我的食品', groups.personal],
                    ['公共食品', groups.public],
                  ].map(([title, items]) => items.length ? (
                    <section key={title} className="space-y-2" data-testid={`food-group-${title === '我的食品' ? 'personal' : 'public'}`}>
                      <h3 className="px-1 pt-2 text-xs font-medium text-[#5E6660]">{title}</h3>
                      {items.map((f, index) => (
                        <button
                          key={f.id || `${f.name}-${index}`}
                          onClick={() => selectFood(f)}
                          data-testid={`food-select-${f.id || index}`}
                          className="w-full text-left rounded-2xl bg-white border border-[#E5E5E0] p-3.5 flex items-center justify-between hover:border-[#6B8067]/40"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[13.5px] text-[#2C332F] break-words">{f.name}</p>
                              <span className="rounded-full bg-[#F0EFE9] px-2 py-0.5 text-[10px] text-[#5E6660]" aria-label={f.visibility === 'public' ? '公共食品' : '个人食品'}>{f.visibility === 'public' ? '公共' : '个人'}</span>
                            </div>
                            {f.brand ? <p className="text-[11px] text-[#5E6660] mt-1 break-words">品牌：{f.brand}</p> : null}
                            <p className="font-num text-[11px] text-[#858C88] mt-0.5">每100g · P{f.p100 || 0} · F{f.f100 || 0} · C{f.c100 || 0}</p>
                          </div>
                          <p className="font-num text-[14px] text-[#2C332F] shrink-0">{f.cal100 || 0} <span className="text-[10px] text-[#858C88]">kcal</span></p>
                        </button>
                      ))}
                    </section>
                  ) : null)}

                  {!loadingFoods && groups.personal.length === 0 && groups.public.length === 0 && (
                    <p className="text-center text-sm text-[#858C88] py-8">食物库还是空的，请添加第一个食物</p>
                  )}
                </div>
              </div>
            </>
          )}

          {selected && (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 space-y-4">
              <div className="rounded-2xl bg-white border border-[#E5E5E0] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] text-[#2C332F] break-words">{selected.name}</p>
                  <span className="rounded-full bg-[#F0EFE9] px-2 py-0.5 text-[10px] text-[#5E6660]">{selected.visibility === 'public' ? '公共' : '个人'}</span>
                </div>
                {selected.brand ? <p className="text-[11px] text-[#5E6660] mt-1">品牌：{selected.brand}</p> : null}
                <p className="text-[11px] text-[#858C88] mt-1">输入克重后确认添加</p>
              </div>

              {selected.visibility !== 'public' && selected.portions?.length ? (
                <div>
                  <p className="text-[12px] text-[#858C88]">可用分量</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.portions.map((portion) => (
                      <button type="button" key={portion.id || portion.name} onClick={() => selectPortion(portion)} className={`rounded-full border px-3 py-2 text-xs ${selectedPortion?.id === portion.id ? 'border-[#6B8067] bg-[#EFF2ED] text-[#5E6660]' : 'border-[#E5E5E0] bg-white text-[#5E6660]'}`}>
                        {portion.name} · {portion.grams}g{portion.isDefault ? ' · 默认' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="text-[12px] text-[#858C88]">克重 (g)</label>
                <Input
                  type="number"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="mt-1 h-11 bg-white border-[#E5E5E0]"
                />
              </div>

              {preview && (
                <div className="rounded-2xl bg-white border border-[#E5E5E0] p-4 text-[12px] text-[#2C332F]">
                  <p>{preview.cal} kcal</p>
                  <p>P{preview.p}g · F{preview.f}g · C{preview.c}g</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelected(null)} disabled={submitting}>
                  返回
                </Button>
                <Button className="flex-1 bg-[#6B8067] hover:bg-[#5a6d57]" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? '保存中...' : '确认添加'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
