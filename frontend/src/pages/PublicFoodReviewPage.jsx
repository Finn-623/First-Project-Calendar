import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { foodService } from '../services/foodService';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';

const PAGE_SIZE = 20;
const CATEGORIES = [
  'grains_staples', 'potatoes_starchy_vegetables', 'meat_poultry',
  'fish_seafood', 'eggs', 'dairy', 'legumes_soy', 'vegetables', 'fruits',
  'nuts_seeds', 'oils_fats', 'condiments_sauces', 'beverages_non_alcoholic',
  'mixed_simple_foods',
];
const STATUSES = [
  ['pending', '待审核'],
  ['approved', '已批准'],
  ['disabled', '已停用'],
];

const displayValue = (value, suffix = '') =>
  value === null || value === undefined || value === ''
    ? '暂无数据'
    : `${value}${suffix}`;

const childCount = (value) => Number(value?.[0]?.count || 0);

export const PublicFoodReviewPage = () => {
  const { profile } = useStore();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const [foods, setFoods] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('pending');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [detail, setDetail] = useState(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    const result = await foodService.loadPublicFoodReviewQueue({
      status, category, query, page, pageSize: PAGE_SIZE,
    });
    if (requestId !== requestRef.current) return;
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message || '加载审核食品失败');
      return;
    }
    setFoods(result.data);
    setTotal(result.count);
    setSelected([]);
  }, [category, isAdmin, page, query, status]);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/library', { replace: true });
      return undefined;
    }
    void load();
    return () => { requestRef.current += 1; };
  }, [isAdmin, load, navigate]);

  const allSelected = foods.length > 0 && foods.every((food) => selected.includes(food.id));

  const toggleOne = (id) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const requestReview = (ids, targetStatus) => {
    if (submitting || ids.length === 0) return;
    setConfirm({ ids: [...ids], targetStatus });
  };

  const submitReview = async () => {
    if (!confirm || submitting) return;
    setSubmitting(true);
    const result = await foodService.reviewPublicFoods(
      confirm.ids,
      confirm.targetStatus,
      '管理员审核页面操作'
    );
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error.message || '审核操作失败');
      return;
    }
    setConfirm(null);
    const affected = new Set(result.data?.success_items?.map((item) => item.food_id) || []);
    setFoods((current) => current.filter((food) => !affected.has(food.id)));
    setTotal((current) => Math.max(0, current - affected.size));
    setSelected((current) => current.filter((id) => !affected.has(id)));
    toast.success(`已处理 ${result.data?.success || 0} 条食品`);
  };

  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-[#F7F7F5] px-4 pt-safe pb-28 overflow-x-hidden">
      <div className="max-w-3xl mx-auto pt-4">
        <SettingsSubpageHeader
          title="公共食品审核"
          description="逐条或小批量审核公共食品，每次最多50条。"
          backTo="/library"
          backLabel="返回食物库"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            aria-label="搜索审核食品"
            value={query}
            placeholder="搜索中文名、英文名或外部ID"
            onChange={(event) => { setQuery(event.target.value); setPage(0); }}
          />
          <select
            aria-label="审核状态"
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(0); }}
            className="min-h-11 rounded-md border border-input bg-white px-3 text-sm"
          >
            {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            aria-label="一级分类"
            value={category}
            onChange={(event) => { setCategory(event.target.value); setPage(0); }}
            className="min-h-11 rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="">全部分类</option>
            {CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Checkbox
            aria-label="选择当前页全部食品"
            checked={allSelected}
            onCheckedChange={() => setSelected(allSelected ? [] : foods.map((food) => food.id))}
          />
          <span className="text-xs text-[#858C88]">已选 {selected.length} / 共 {total} 条</span>
          <Button
            size="sm"
            disabled={selected.length === 0 || submitting}
            onClick={() => requestReview(selected, 'approved')}
          >
            批量批准
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={selected.length === 0 || submitting}
            onClick={() => requestReview(selected, 'disabled')}
          >
            批量停用
          </Button>
        </div>

        <section className="mt-4 space-y-3" aria-busy={loading}>
          {loading ? <p className="py-10 text-center text-sm text-[#858C88]">正在加载审核食品...</p> : null}
          {!loading && foods.length === 0
            ? <p className="py-10 text-center text-sm text-[#858C88]">当前筛选没有食品</p>
            : null}
          {!loading && foods.map((food) => (
            <article key={food.id} className="rounded-2xl border border-[#E5E5E0] bg-white p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  aria-label={`选择${food.name}`}
                  checked={selected.includes(food.id)}
                  onCheckedChange={() => toggleOne(food.id)}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm text-[#2C332F] break-words">{food.name}</h2>
                  <p className="text-xs text-[#858C88] break-words">{food.name_en || '暂无英文名'}</p>
                  <p className="mt-2 text-xs text-[#858C88] break-all">
                    {food.primary_category} · {food.secondary_category || '无二级分类'} · {food.source_name} · {food.external_food_id}
                  </p>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs text-[#5F6662]">
                    <span>热量 {displayValue(food.energy_kcal, ' kcal')}</span>
                    <span>蛋白质 {displayValue(food.protein_g, 'g')}</span>
                    <span>碳水 {displayValue(food.carbohydrate_g, 'g')}</span>
                    <span>脂肪 {displayValue(food.fat_g, 'g')}</span>
                    <span>纤维 {displayValue(food.fiber_g, 'g')}</span>
                    <span>糖 {displayValue(food.total_sugar_g, 'g')}</span>
                    <span>钠 {displayValue(food.sodium_mg, 'mg')}</span>
                    <span>别名 {childCount(food.food_public_aliases)} · 份量 {childCount(food.food_portions)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setDetail(food)}>查看详情</Button>
                {status !== 'approved'
                  ? <Button size="sm" disabled={submitting} onClick={() => requestReview([food.id], 'approved')}>批准</Button>
                  : null}
                {status !== 'disabled'
                  ? <Button size="sm" variant="destructive" disabled={submitting} onClick={() => requestReview([food.id], 'disabled')}>停用</Button>
                  : null}
                {status === 'disabled'
                  ? <Button size="sm" variant="outline" disabled={submitting} onClick={() => requestReview([food.id], 'pending')}>恢复待审核</Button>
                  : null}
              </div>
            </article>
          ))}
        </section>

        <div className="mt-4 flex justify-between items-center">
          <Button variant="outline" disabled={page === 0 || loading} onClick={() => setPage((v) => v - 1)}>上一页</Button>
          <span className="text-xs text-[#858C88]">第 {page + 1} 页</span>
          <Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => setPage((v) => v + 1)}>下一页</Button>
        </div>
      </div>

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && !submitting && setConfirm(null)}>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>确认审核操作</AlertDialogTitle>
            <AlertDialogDescription>
              将 {confirm?.ids.length || 0} 条食品改为“{STATUSES.find(([value]) => value === confirm?.targetStatus)?.[1]}”？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={submitting} onClick={submitReview}>
              {submitting ? '处理中...' : '确认'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.name}</DialogTitle></DialogHeader>
          <pre className="whitespace-pre-wrap break-words text-xs text-[#5F6662]">
            {detail ? JSON.stringify({
              name_en: detail.name_en,
              source: detail.source_name,
              external_id: detail.external_food_id,
              category: detail.primary_category,
              status: detail.review_status,
              review_note: detail.review_note,
            }, null, 2) : ''}
          </pre>
        </DialogContent>
      </Dialog>
    </main>
  );
};
