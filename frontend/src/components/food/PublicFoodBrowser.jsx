import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { foodService } from '../../services/foodService';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

const PAGE_SIZE = 24;
const INTAKE_LABELS = {
  carbohydrate: '碳水', protein: '蛋白质', fat: '脂肪', fiber: '膳食纤维',
};
const CATEGORY_LABELS = {
  grains_staples: '谷物', potatoes_starchy_vegetables: '薯类', meat_poultry: '肉禽',
  fish_seafood: '水产', eggs: '蛋', dairy: '奶', legumes_soy: '豆类', vegetables: '蔬菜',
  fruits: '水果', nuts_seeds: '坚果', oils_fats: '油脂', condiments_sauces: '调味品',
  beverages_non_alcoholic: '饮品', mixed_simple_foods: '混合食品',
};
const categoryLabel = (value) => CATEGORY_LABELS[value] || value;

const nutrientText = (value, unit) => {
  if (value == null || Number.isNaN(value)) return '暂无数据';
  const rounded = Number(value).toFixed(1).replace(/\.0$/, '');
  return `${rounded}${unit}`;
};

const FoodCard = ({ food, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(food.id)}
    className="w-full rounded-2xl border border-[#E5E5E0] bg-white p-4 text-left min-h-[132px]"
    data-testid={`public-food-${food.id}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[14px] font-medium text-[#2C332F] break-words">{food.name}</h3>
        {food.nameEn ? <p className="mt-1 text-[11px] leading-4 text-[#858C88] break-words">{food.nameEn}</p> : null}
        {food.brand ? <p className="mt-1 text-[11px] text-[#5E6660] break-words">{food.brand}</p> : null}
      </div>
      <span className="shrink-0 rounded-full bg-[#EEF3EC] px-2 py-1 text-[10px] text-[#60725D]">公共食品</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-[#66706A]">
      {food.primaryCategory ? <span className="rounded-full bg-[#F4F4F1] px-2 py-1">{categoryLabel(food.primaryCategory)}</span> : null}
      {food.intakeTypes.map((type) => <span key={type} className="rounded-full bg-[#F4F4F1] px-2 py-1">{INTAKE_LABELS[type] || type}</span>)}
    </div>
    <div className="mt-3 border-t border-[#EEEEEA] pt-3">
      <p className="text-[10px] text-[#858C88]">每100g</p>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-[#5E6660]">
        <span>热量 <strong className="font-normal text-[#2C332F]">{nutrientText(food.nutrients.energyKcal, 'kcal')}</strong></span>
        <span>蛋白质 <strong className="font-normal text-[#2C332F]">{nutrientText(food.nutrients.proteinG, 'g')}</strong></span>
        <span>碳水 <strong className="font-normal text-[#2C332F]">{nutrientText(food.nutrients.carbohydrateG, 'g')}</strong></span>
        <span>脂肪 <strong className="font-normal text-[#2C332F]">{nutrientText(food.nutrients.fatG, 'g')}</strong></span>
      </div>
      <p className="mt-3 text-right text-[11px] font-medium text-[#6B8067]">查看详情 ›</p>
    </div>
  </button>
);

const FoodDetail = ({ foodId, onClose }) => {
  const [state, setState] = useState({ loading: true, food: null, error: null });

  useEffect(() => {
    let active = true;
    setState({ loading: true, food: null, error: null });
    void foodService.getVisiblePublicFoodDetail(foodId).then(({ data, error }) => {
      if (active) setState({ loading: false, food: data, error });
    });
    return () => { active = false; };
  }, [foodId]);

  const food = state.food;
  return (
    <Dialog open={Boolean(foodId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>公共食品详情</DialogTitle></DialogHeader>
        {state.loading ? <p className="py-8 text-center text-sm text-[#858C88]">正在加载食品详情…</p> : null}
        {state.error || (!state.loading && !food) ? <p className="py-8 text-center text-sm text-[#C76D5E]">食品不可用</p> : null}
        {food ? (
          <div className="space-y-5" data-testid="public-food-detail">
            <div>
              <h2 className="text-lg font-medium text-[#2C332F] break-words">{food.name}</h2>
              {food.nameEn ? <p className="mt-1 text-sm text-[#858C88] break-words">{food.nameEn}</p> : null}
              {food.brand ? <p className="mt-1 text-sm text-[#5E6660]">品牌：{food.brand}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {food.primaryCategory ? <span className="rounded-full bg-[#F4F4F1] px-2.5 py-1">{categoryLabel(food.primaryCategory)}</span> : null}
              {food.secondaryCategory ? <span className="rounded-full bg-[#F4F4F1] px-2.5 py-1">{categoryLabel(food.secondaryCategory)}</span> : null}
              {food.intakeTypes.map((type) => <span key={type} className="rounded-full bg-[#EEF3EC] px-2.5 py-1">{INTAKE_LABELS[type] || type}</span>)}
            </div>
            <section>
              <h3 className="text-sm font-medium text-[#2C332F]">每100g营养</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#5E6660]">
                {[
                  ['热量', food.nutrients.energyKcal, 'kcal'], ['蛋白质', food.nutrients.proteinG, 'g'],
                  ['碳水', food.nutrients.carbohydrateG, 'g'], ['脂肪', food.nutrients.fatG, 'g'],
                  ['膳食纤维', food.nutrients.fiberG, 'g'], ['饱和脂肪', food.nutrients.saturatedFatG, 'g'],
                  ['糖', food.nutrients.totalSugarG, 'g'], ['钠', food.nutrients.sodiumMg, 'mg'],
                  ['钾', food.nutrients.potassiumMg, 'mg'],
                ].map(([label, value, unit]) => (
                  <div key={label} className="rounded-xl bg-[#F7F7F5] px-3 py-2"><span>{label}</span><strong className="float-right font-normal text-[#2C332F]">{nutrientText(value, unit)}</strong></div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-medium text-[#2C332F]">可用份量</h3>
              {food.portions.length ? <ul className="mt-2 space-y-1 text-xs text-[#5E6660]">{food.portions.map((portion) => <li key={portion.id}>{portion.name} · {nutrientText(portion.grams, 'g')}</li>)}</ul> : <p className="mt-2 text-xs text-[#858C88]">暂无标准份量，可按克记录</p>}
            </section>
            {food.aliases.length ? <section><h3 className="text-sm font-medium text-[#2C332F]">公开别名</h3><p className="mt-2 text-xs leading-5 text-[#5E6660] break-words">{food.aliases.join('、')}</p></section> : null}
            <p className="text-xs text-[#858C88]">数据来源：{food.sourceName || '暂无数据'}</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export const PublicFoodBrowser = () => {
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [intakeType, setIntakeType] = useState('');
  const [page, setPage] = useState(0);
  const [facets, setFacets] = useState({ categories: [], intakeTypes: [] });
  const [state, setState] = useState({ loading: true, foods: [], count: 0, error: null });
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setQuery(queryInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    void foodService.loadVisiblePublicFoodFacets().then(({ categories, intakeTypes }) => {
      setFacets({ categories, intakeTypes });
    });
  }, []);

  const load = async () => {
    const requestId = ++requestIdRef.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    const result = await foodService.listVisiblePublicFoods({ query, category, intakeType, page, pageSize: PAGE_SIZE });
    if (requestId !== requestIdRef.current) return;
    setState({ loading: false, foods: result.data || [], count: result.count || 0, error: result.error || null });
  };

  useEffect(() => { void load(); }, [category, intakeType, page, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageCount = Math.max(1, Math.ceil(state.count / PAGE_SIZE));
  const clearFilters = () => {
    setQueryInput('');
    setQuery('');
    setCategory('');
    setIntakeType('');
    setPage(0);
  };

  return (
    <section className="px-5 pb-4" aria-label="公共食品">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858C88]" />
        <Input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="搜索中文名、英文名、品牌或别名" className="h-11 rounded-xl border-[#E5E5E0] bg-white pl-9 text-base" data-testid="public-food-search" />
      </div>
      <div className="mt-4 space-y-4 rounded-2xl border border-[#E5E5E0] bg-white p-3" aria-label="公共食品筛选">
        <div>
          <p className="mb-2 text-xs font-medium text-[#2C332F]">食品分类</p>
          <div className="flex gap-2 overflow-x-auto pb-1" data-testid="public-food-categories">
            <button type="button" aria-pressed={!category} onClick={() => { setCategory(''); setPage(0); }} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs ${!category ? 'bg-[#2C332F] text-white' : 'bg-white'}`}>全部分类</button>
            {facets.categories.map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => { setCategory(value); setPage(0); }} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs ${category === value ? 'bg-[#2C332F] text-white' : 'bg-white'}`}>{categoryLabel(value)}</button>)}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-[#2C332F]">主要摄入类型</p>
          <div className="flex gap-2 overflow-x-auto pb-1" data-testid="public-food-intake-types">
            <button type="button" aria-pressed={!intakeType} onClick={() => { setIntakeType(''); setPage(0); }} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs ${!intakeType ? 'bg-[#6B8067] text-white' : 'bg-white'}`}>全部摄入类型</button>
            {facets.intakeTypes.map((value) => <button key={value} type="button" aria-pressed={intakeType === value} onClick={() => { setIntakeType(value); setPage(0); }} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs ${intakeType === value ? 'bg-[#6B8067] text-white' : 'bg-white'}`}>{INTAKE_LABELS[value] || value}</button>)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#858C88]">
        <span data-testid="public-food-count">找到 {state.count} 条公共食品</span>
        {(query || category || intakeType) ? <button type="button" onClick={clearFilters} className="inline-flex min-h-10 items-center gap-1 text-[#6B8067]"><X size={13} /> 清除筛选</button> : null}
      </div>
      {state.loading ? <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="正在加载公共食品">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-[#ECEDE9]" />)}</div> : null}
      {state.error && !state.loading ? <div className="mt-6 text-center"><p className="text-sm text-[#C76D5E]">公共食品加载失败</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void load()}>重试</Button></div> : null}
      {!state.loading && !state.error && !state.foods.length ? <p className="py-10 text-center text-sm text-[#858C88]">没有找到符合条件的公共食品</p> : null}
      {!state.loading && !state.error ? <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="public-food-list">{state.foods.map((food) => <FoodCard key={food.id} food={food} onOpen={setSelectedFoodId} />)}</div> : null}
      {!state.loading && !state.error && state.count > PAGE_SIZE ? <div className="mt-5 flex items-center justify-center gap-3"><button type="button" aria-label="上一页" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl border disabled:opacity-40"><ChevronLeft size={16} /></button><span className="text-xs text-[#5E6660]">{page + 1} / {pageCount}</span><button type="button" aria-label="下一页" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border disabled:opacity-40"><ChevronRight size={16} /></button></div> : null}
      {selectedFoodId ? <FoodDetail foodId={selectedFoodId} onClose={() => setSelectedFoodId(null)} /> : null}
    </section>
  );
};
