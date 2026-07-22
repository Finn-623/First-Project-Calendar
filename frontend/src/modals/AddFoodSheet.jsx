import React, { useMemo, useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { fetchFoodLibrary, computeEntryFromLibraryFood } from '../services/foodService';
import { round1, roundCalories } from '../lib/nutrition';

const emptyCustom = { name: '', cal100: '', p100: '', f100: '', c100: '' };

export const AddFoodSheet = ({ open, onOpenChange, targetTitle, onConfirm, loading = false }) => {
  const { user } = useStore();
  const [query, setQuery] = useState('');
  const [library, setLibrary] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [selected, setSelected] = useState(null);
  const [grams, setGrams] = useState(100);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [useCustom, setUseCustom] = useState(false);
  const [custom, setCustom] = useState(emptyCustom);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected(null);
      setGrams(100);
      setSaveToLibrary(false);
      setUseCustom(false);
      setCustom(emptyCustom);
      return;
    }

    if (!user?.id) return;
    setLoadingLibrary(true);
    fetchFoodLibrary({ userId: user.id })
      .then((rows) => setLibrary(rows))
      .catch((e) => toast.error(e?.message || '食物库加载失败'))
      .finally(() => setLoadingLibrary(false));
  }, [open, user?.id]);

  const list = useMemo(
    () => library.filter((f) => f.name.includes(query.trim())),
    [library, query],
  );

  const resolved = useMemo(() => {
    if (!useCustom && selected) {
      const entry = computeEntryFromLibraryFood({ libraryFood: selected, grams: Number(grams) || 0 });
      return {
        sourceFoodId: entry.sourceFoodId,
        food: { ...entry.food, unit: 'g' },
        libraryPayload: null,
      };
    }
    if (!useCustom) return null;
    const cal100 = Number(custom.cal100);
    const p100 = Number(custom.p100);
    const f100 = Number(custom.f100);
    const c100 = Number(custom.c100);
    const q = Number(grams || 0);
    const hasName = !!custom.name.trim();
    const validQuantity = q > 0;
    const validMacros = [cal100, p100, f100, c100].every((x) => Number.isFinite(x) && x >= 0);
    if (!hasName || !validQuantity || !validMacros) return null;

    const ratio = q / 100;
    return {
      sourceFoodId: null,
      food: {
        name: custom.name.trim(),
        grams: q,
        unit: 'g',
        cal: roundCalories(cal100 * ratio),
        p: round1(p100 * ratio),
        f: round1(f100 * ratio),
        c: round1(c100 * ratio),
      },
      libraryPayload: {
        name: custom.name.trim(),
        category: '自定义',
        cal100: roundCalories(cal100),
        p100: round1(p100),
        f100: round1(f100),
        c100: round1(c100),
      },
    };
  }, [selected, grams, useCustom, custom]);

  const handleConfirm = async () => {
    if (!resolved) {
      toast.error('请先选择或填写有效食物');
      return;
    }
    const success = await onConfirm({
      ...resolved,
      saveToLibrary: !!saveToLibrary,
    });
    if (success) onOpenChange(false);
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
            <button
              onClick={() => { setUseCustom((v) => !v); setSelected(null); }}
              className="mt-2 text-[12px] text-[#6B8067]"
              data-testid="toggle-custom-food"
            >
              {useCustom ? '返回食物库选择' : '没有匹配？手动填写食物'}
            </button>
          </div>

          {!useCustom && (
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div className="space-y-2">
                {loadingLibrary && <p className="text-center text-sm text-[#858C88] py-8">加载中...</p>}
                {!loadingLibrary && list.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f)}
                    data-testid={`food-select-${f.id}`}
                    className={`w-full text-left rounded-2xl bg-white border p-3.5 flex items-center justify-between ${
                      selected?.id === f.id ? 'border-[#6B8067]' : 'border-[#E5E5E0]'
                    }`}
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
                {!loadingLibrary && list.length === 0 && (
                  <p className="text-center text-sm text-[#858C88] py-8">没有找到相关食物</p>
                )}
              </div>
            </div>
          )}

          {useCustom && (
            <div className="px-5 space-y-3">
              <Input value={custom.name} onChange={(e) => setCustom((v) => ({ ...v, name: e.target.value }))} placeholder="食物名称" className="bg-white border-[#E5E5E0] rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" value={custom.cal100} onChange={(e) => setCustom((v) => ({ ...v, cal100: e.target.value }))} placeholder="每100g热量" className="bg-white border-[#E5E5E0] rounded-xl" />
                <Input type="number" value={custom.p100} onChange={(e) => setCustom((v) => ({ ...v, p100: e.target.value }))} placeholder="每100g蛋白" className="bg-white border-[#E5E5E0] rounded-xl" />
                <Input type="number" value={custom.f100} onChange={(e) => setCustom((v) => ({ ...v, f100: e.target.value }))} placeholder="每100g脂肪" className="bg-white border-[#E5E5E0] rounded-xl" />
                <Input type="number" value={custom.c100} onChange={(e) => setCustom((v) => ({ ...v, c100: e.target.value }))} placeholder="每100g碳水" className="bg-white border-[#E5E5E0] rounded-xl" />
              </div>
            </div>
          )}

          <div className="px-5 mt-4">
            <label className="text-[12px] text-[#858C88]">重量 (g)</label>
            <Input
              type="number"
              inputMode="numeric"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              className="mt-1.5 h-12 text-xl font-num bg-white border-[#E5E5E0] rounded-xl"
              data-testid="food-grams-input"
            />
          </div>

          {resolved && (
            <div className="mx-5 mt-4 rounded-2xl p-4 bg-[#6B8067]/6" style={{ background: '#EFF2ED' }}>
              <p className="text-[11px] uppercase tracking-widest text-[#858C88]">计算结果</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-num text-3xl font-medium text-[#2C332F]" data-testid="food-preview-cal">{resolved.food.cal}</span>
                <span className="text-xs text-[#858C88]">kcal</span>
              </div>
              <p className="font-num text-[12px] text-[#2C332F]/80 mt-1">
                蛋白 <b>{resolved.food.p}g</b> · 脂肪 <b>{resolved.food.f}g</b> · 碳水 <b>{resolved.food.c}g</b>
              </p>
            </div>
          )}

          <div className="px-5 mt-4">
            <label className="flex items-center gap-2 text-[12px] text-[#2C332F]">
              <Checkbox checked={saveToLibrary} onCheckedChange={(v) => setSaveToLibrary(!!v)} />
              同时保存到我的食物库
            </label>
          </div>

          <div className="mt-auto px-5 pb-6 pt-5">
            <Button
              onClick={handleConfirm}
              disabled={loading}
              data-testid="food-confirm-btn"
              className="w-full h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white text-[14px]"
            >
              {loading ? '保存中...' : '确认添加'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
