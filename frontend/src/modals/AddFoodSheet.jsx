import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { ArrowLeft, Minus, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { foodService } from '../services/foodService';

const scale = (food, grams) => {
  const k = (Number(grams) || 0) / 100;
  const scaleNullable = (value, digits = 0) => {
    if (value == null || Number.isNaN(Number(value))) return null;
    const scaled = Number(value) * k;
    return digits ? +(scaled.toFixed(digits)) : Math.round(scaled);
  };
  return {
    cal: scaleNullable(food.cal100),
    p: scaleNullable(food.p100, 1),
    f: scaleNullable(food.f100, 1),
    c: scaleNullable(food.c100, 1),
  };
};

const nutrientText = (value, suffix = '') => value == null ? '暂无数据' : `${value}${suffix}`;

export const AddFoodSheet = ({ open, onOpenChange, targetTitle, onConfirm }) => {
  const { foods, myFoods, myFoodsStatus, user, refreshFoods, ensureMyFoodsLoaded } = useStore();
  const personalFoods = useMemo(() => (myFoods ?? foods ?? []).filter((food) => food?.is_active !== false && food?.isActive !== false), [foods, myFoods]);
  const [publicFoods, setPublicFoods] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedPortion, setSelectedPortion] = useState(null);
  const [portionQuantity, setPortionQuantity] = useState(1);
  const [grams, setGrams] = useState(100);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchRequestRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected(null);
      setSelectedPortion(null);
      setPortionQuantity(1);
      setGrams(100);
      setLoadingFoods(false);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    let disposed = false;

    const loadFoodsOnOpen = async () => {
      if (!open || !user?.id) return;

      setLoadingFoods(!personalFoods.length && myFoodsStatus !== 'success');
      const personalRequest = ensureMyFoodsLoaded
        ? ensureMyFoodsLoaded(user.id)
        : (personalFoods.length ? Promise.resolve({ data: personalFoods }) : refreshFoods(user.id));
      const publicRequest = foodService.listVisiblePublicFoods({ page: 0 });
      await Promise.allSettled([personalRequest, publicRequest]);
      const result = await publicRequest;
      if (!disposed) {
        setPublicFoods((result.data || []).map((food) => ({
          ...food,
          visibility: 'public',
          is_active: true,
          cal100: food.nutrients.energyKcal,
          p100: food.nutrients.proteinG,
          f100: food.nutrients.fatG,
          c100: food.nutrients.carbohydrateG,
        })));
        setLoadingFoods(false);
      }
    };

    loadFoodsOnOpen().catch(() => {
      if (!disposed) setLoadingFoods(false);
    });

    return () => {
      disposed = true;
    };
  }, [ensureMyFoodsLoaded, myFoodsStatus, open, personalFoods, refreshFoods, user?.id]);

  useEffect(() => {
    const requestId = ++searchRequestRef.current;
    if (!open || !user?.id || !query.trim()) return undefined;
    const timer = window.setTimeout(async () => {
      const result = await foodService.listVisiblePublicFoods({ query, page: 0 });
      if (requestId !== searchRequestRef.current) return;
      setPublicFoods((result.data || []).map((food) => ({
        ...food,
        visibility: 'public',
        is_active: true,
        cal100: food.nutrients.energyKcal,
        p100: food.nutrients.proteinG,
        f100: food.nutrients.fatG,
        c100: food.nutrients.carbohydrateG,
      })));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, query, user?.id]);

  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visible = [...personalFoods, ...(publicFoods || [])].filter((food) => {
      if (food?.is_active === false || food?.isActive === false) return false;
      if (food?.visibility !== 'public' && food?.user_id !== user?.id) return false;
      if (!normalizedQuery) return true;
      return [food.name, food.brand, food.nameEn, food.name_en, ...(food.aliases || [])].filter(Boolean)
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
  }, [personalFoods, publicFoods, query, user?.id]);

  const preview = selected ? scale(selected, Number(grams) || 0) : null;

  const selectFood = (food) => {
    const defaultPortion = food.visibility !== 'public'
      ? (food.portions || []).find((portion) => portion.isDefault)
      : null;
    setSelected(food);
    setSelectedPortion(defaultPortion || null);
    setPortionQuantity(1);
    setGrams(defaultPortion ? (defaultPortion.grams ?? '') : 100);
  };

  const selectPortion = (portion) => {
    if (portion.unit === 'ml' && portion.grams == null) {
      setSelectedPortion(portion);
      setGrams('');
      return;
    }
    setSelectedPortion(portion);
    setPortionQuantity(1);
    setGrams(portion.grams ?? '');
  };

  const changeQuantity = (delta) => {
    if (!selectedPortion?.grams) return;
    const nextQuantity = Math.max(1, portionQuantity + delta);
    setPortionQuantity(nextQuantity);
    setGrams(Number(selectedPortion.grams) * nextQuantity);
  };

  const useGramsMode = () => {
    setSelectedPortion(null);
    setPortionQuantity(1);
    setGrams(Number(grams) > 0 ? grams : 100);
  };

  const handleConfirm = () => {
    if (!selected || submitting) return;
    const numericGrams = Number(grams);
    if (selectedPortion?.unit === 'ml' && selectedPortion.grams == null && (!Number.isFinite(numericGrams) || numericGrams <= 0)) {
      toast.error('该食品未设置毫升与克的换算关系，请按克记录');
      return;
    }
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
        className="rounded-t-3xl border-[#E5E5E0] bg-[#F7F7F5] w-full max-w-md mx-auto p-0 h-[min(92dvh,760px)] max-h-[calc(100dvh-16px)] overflow-hidden data-[state=closed]:duration-0 data-[state=closed]:animate-none"
        overlayClassName="data-[state=closed]:duration-0 data-[state=closed]:animate-none"
        data-testid="add-food-sheet"
      >
        <div className="flex flex-col h-full">
          <SheetHeader className="shrink-0 px-5 pt-5 pb-3 text-left">
            <SheetTitle className="text-base font-medium text-[#2C332F]">
              添加食物 · <span className="text-[#858C88] text-sm">{targetTitle}</span>
            </SheetTitle>
            <SheetDescription className="sr-only">
              搜索并选择食物，输入克重后添加到当前餐次。
            </SheetDescription>
          </SheetHeader>

          {!selected && (
            <>
              <div className="shrink-0 px-5 pb-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858C88]" strokeWidth={1.5} />
                  <Input
                    aria-label="搜索食品"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索食物名称"
                    className="pl-9 h-11 bg-white border-[#E5E5E0] rounded-xl"
                    data-testid="food-search-input"
                  />
                  {query ? <button type="button" aria-label="清除搜索" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858C88]"><X size={15} /></button> : null}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-4">
                <div className="space-y-2">
                  {loadingFoods && personalFoods.length === 0 && (
                    <p className="text-center text-sm text-[#858C88] py-8">正在加载食物库...</p>
                  )}

                  {[
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
                          className="w-full text-left bg-white border-y border-[#E5E5E0] -mb-px px-3.5 py-3 flex items-center justify-between hover:bg-[#F1F4EF] first:rounded-t-xl last:rounded-b-xl"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[13.5px] text-[#2C332F] break-words">{f.name}</p>
                              <span className="rounded-full bg-[#F0EFE9] px-2 py-0.5 text-[10px] text-[#5E6660]" aria-label={f.visibility === 'public' ? '公共食品' : '个人食品'}>{f.visibility === 'public' ? '公共' : '个人'}</span>
                            </div>
                            {f.brand ? <p className="text-[11px] text-[#5E6660] mt-1 break-words">品牌：{f.brand}</p> : null}
                            <p className="font-num text-[11px] text-[#858C88] mt-0.5">每100g · {nutrientText(f.cal100, ' kcal')}</p>
                          </div>
                          <span className="text-[#858C88] shrink-0" aria-hidden="true">›</span>
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
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-1 pb-5 space-y-4">
              <div className="flex items-start gap-3 border-b border-[#E5E5E0] pb-4">
                <button type="button" aria-label="返回" onClick={() => setSelected(null)} disabled={submitting} className="mt-0.5 text-[#5E6660]"><ArrowLeft size={19} /></button>
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] text-[#2C332F] break-words">{selected.name}</p>
                  <span className="rounded-full bg-[#F0EFE9] px-2 py-0.5 text-[10px] text-[#5E6660]">{selected.visibility === 'public' ? '公共' : '个人'}</span>
                </div>
                {selected.brand ? <p className="text-[11px] text-[#5E6660] mt-1">品牌：{selected.brand}</p> : null}
                <p className="text-[11px] text-[#858C88] mt-1">输入克重后确认添加</p>
                </div>
              </div>

              {selected.visibility !== 'public' && selected.portions?.length ? (
                <div>
                  <p className="text-[12px] text-[#858C88]">可用分量</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.portions.map((portion) => (
                      <button type="button" key={portion.id || portion.name} onClick={() => selectPortion(portion)} className={`rounded-full border px-3 py-2 text-xs ${selectedPortion?.id === portion.id ? 'border-[#6B8067] bg-[#EFF2ED] text-[#5E6660]' : 'border-[#E5E5E0] bg-white text-[#5E6660]'}`}>
                        {portion.name} · {portion.amount ?? portion.grams}{portion.unit === 'ml' ? 'ml' : 'g'}{portion.isDefault ? ' · 默认' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                {selectedPortion?.grams ? (
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] text-[#858C88]">数量</label>
                    <div className="flex items-center gap-3">
                      <button type="button" aria-label="减少数量" onClick={() => changeQuantity(-1)} className="h-8 w-8 rounded-full border border-[#D8DDD6] bg-white text-[#5E6660]"><Minus size={14} className="mx-auto" /></button>
                      <span className="font-num w-5 text-center text-sm">{portionQuantity}</span>
                      <button type="button" aria-label="增加数量" onClick={() => changeQuantity(1)} className="h-8 w-8 rounded-full border border-[#D8DDD6] bg-white text-[#5E6660]"><Plus size={14} className="mx-auto" /></button>
                    </div>
                  </div>
                ) : null}
                <label className="text-[12px] text-[#858C88]">克重 (g)</label>
                <Input
                  type="number"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="mt-1 h-11 bg-white border-[#E5E5E0]"
                />
                {selectedPortion?.grams ? <button type="button" onClick={useGramsMode} className="mt-2 text-[11px] text-[#6B8067]">改为直接输入克重</button> : null}
                {selectedPortion?.unit === 'ml' && selectedPortion.grams == null ? <p className="mt-1 text-[11px] text-[#C76D5E]">该食品未设置毫升与克的换算关系，请按克记录</p> : null}
              </div>

              {preview && (
                <div className="border-y border-[#E5E5E0] py-3 text-[12px] text-[#2C332F]">
                  <p className="font-medium">{nutrientText(preview.cal, ' kcal')}</p>
                  <p className="mt-1 text-[#858C88]">P{nutrientText(preview.p, 'g')} · F{nutrientText(preview.f, 'g')} · C{nutrientText(preview.c, 'g')}</p>
                </div>
              )}
            </div>
          )}
          {selected && <div className="shrink-0 border-t border-[#E5E5E0] bg-[#F7F7F5] px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button aria-label="确认添加" className="w-full h-11 bg-[#6B8067] hover:bg-[#5a6d57]" onClick={handleConfirm} disabled={submitting || !Number(grams) || Number(grams) <= 0}>
              {submitting ? '保存中...' : `加入${targetTitle || '当前餐次'}`}
            </Button>
          </div>}
        </div>
      </SheetContent>
    </Sheet>
  );
};
