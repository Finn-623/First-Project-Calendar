import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { showSuccess } from '../lib/notifications';
import { useStore } from '../store';
import { foodService } from '../services/foodService';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { PublicFoodBrowser } from '../components/food/PublicFoodBrowser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const FOOD_CATEGORIES = ['全部', '主食', '蛋白', '脂肪', '蔬菜', '水果'];

const emptyPrivatePortion = () => ({ name: '', amount: '', unit: 'g', grams: '', isDefault: false });

const emptyPrivateForm = () => ({
  name: '',
  name_en: '',
  brand: '',
  category: '其他',
  intakeTypes: [],
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  notes: '',
  portions: [emptyPrivatePortion()],
});

const PRIVATE_CATEGORIES = ['其他', '主食', '蛋白', '脂肪', '蔬菜', '水果'];
const INTAKE_TYPES = [
  ['carbohydrate', '碳水'],
  ['protein', '蛋白质'],
  ['fat', '脂肪'],
  ['fiber', '膳食纤维'],
];

const emptyPublicForm = () => ({
  name: '',
  brand: '',
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  image_url: '',
  notes: '',
  is_active: true,
});

const parseNumber = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return Number.NaN;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const formatTime = (value) => {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const PublicFoodCard = ({ food, onEdit, onToggleActive, submitting }) => (
  <div className="rounded-2xl bg-white border border-[#E5E5E0] p-3.5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13.5px] text-[#2C332F] truncate">{food.name}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${food.isActive ? 'bg-[#EFF2ED] text-[#6B8067]' : 'bg-[#F4F4F2] text-[#858C88]'}`}>
            {food.isActive ? '已启用' : '已停用'}
          </span>
          {food.brand ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0EFE9] text-[#858C88] truncate max-w-[120px]">
              {food.brand}
            </span>
          ) : null}
        </div>
        <p className="font-num text-[11px] text-[#858C88] mt-1">
          每100g · P{food.p100 || 0} · F{food.f100 || 0} · C{food.c100 || 0}
        </p>
        <p className="font-num text-[11px] text-[#858C88] mt-0.5">
          {food.cal100 || 0} kcal · 更新于 {formatTime(food.updated_at)}
        </p>
        <p className="text-[11px] text-[#858C88] mt-1 leading-5">
          来源：{food.notes || '未填写'}
        </p>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2">
        <div className="text-right">
          <p className="font-num text-[15px] font-medium text-[#2C332F]">
            {food.cal100 || 0} <span className="text-[10px] text-[#858C88] font-normal">kcal</span>
          </p>
          <p className="text-[10px] text-[#858C88] mt-0.5">公共食品</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(food)}
            className="inline-flex items-center gap-1 text-[11px] text-[#6B8067] hover:text-[#5a6d57]"
            data-testid={`admin-edit-public-food-${food.id}`}
            disabled={submitting}
          >
            <Pencil size={12} strokeWidth={1.8} /> 编辑
          </button>
          <button
            type="button"
            onClick={() => onToggleActive(food)}
            className={`inline-flex items-center gap-1 text-[11px] ${food.isActive ? 'text-[#D27D67]' : 'text-[#6B8067]'}`}
            data-testid={`admin-toggle-public-food-${food.id}`}
            disabled={submitting}
          >
            {food.isActive ? '停用' : '启用'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const FoodLibraryPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    foods,
    publicFoods,
    user,
    profile,
    refreshFoods,
    loadPublicFoods,
    createPublicFood,
    updatePublicFood,
    setPublicFoodActive,
  } = useStore();

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('全部');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPersonalFood, setSelectedPersonalFood] = useState(null);
  const [privateForm, setPrivateForm] = useState(emptyPrivateForm());
  const [publicCreateOpen, setPublicCreateOpen] = useState(false);
  const [publicEditOpen, setPublicEditOpen] = useState(false);
  const [editingPublicFoodId, setEditingPublicFoodId] = useState(null);
  const [publicSubmitting, setPublicSubmitting] = useState(false);
  const [publicForm, setPublicForm] = useState(emptyPublicForm());
  const activeTab = searchParams.get('tab') === 'mine' ? 'mine' : 'public';
  const setActiveTab = (tab) => setSearchParams(tab === 'mine' ? { tab: 'mine' } : { tab: 'public' }, { replace: true });

  const list = useMemo(() => {
    return (foods || []).filter((f) => {
      if (f.visibility === 'public' || f.user_id !== user?.id || f.is_active === false) return false;
      const matchQ = [f.name, f.brand].filter(Boolean).some((value) => normalizeText(value).includes(normalizeText(query)));
      const matchC = cat === '全部' || f.category === cat;
      return matchQ && matchC;
    });
  }, [foods, query, cat, user?.id]);

  const adminPublicList = useMemo(() => {
    return (publicFoods || []).filter((f) => {
      if (f.review_status === 'pending') return false;
      const matchQ = [f.name, f.brand, f.notes].filter(Boolean).some((value) => normalizeText(value).includes(normalizeText(query)));
      return matchQ;
    }).slice(0, 20);
  }, [publicFoods, query]);

  useEffect(() => {
    if (!user?.id) return;
    Promise.resolve(refreshFoods(user.id)).catch(console.error);
    if (isAdmin) {
      Promise.resolve(loadPublicFoods(user.id)).catch(console.error);
    }
  }, [isAdmin, loadPublicFoods, refreshFoods, user?.id]);

  const updatePrivateForm = (key, value) => {
    setPrivateForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePublicForm = (key, value) => {
    setPublicForm((prev) => ({ ...prev, [key]: value }));
  };

  const validatePrivateForm = () => {
    const name = privateForm.name.trim();
    const calories = parseNumber(privateForm.calories);
    const protein = parseNumber(privateForm.protein);
    const fat = parseNumber(privateForm.fat);
    const carbs = parseNumber(privateForm.carbs);
    const seenPortionNames = new Set();
    const portions = [];

    for (const portion of privateForm.portions || []) {
      const portionName = String(portion.name || '').trim();
      const amountText = String(portion.amount ?? portion.grams ?? '').trim();
      const hasName = Boolean(portionName);
      const hasAmount = Boolean(amountText);
      if (!hasName && !hasAmount) continue;
      if (!portionName) return { ok: false, message: '请填写每个分量的名称' };
      if (!hasAmount) return { ok: false, message: '请填写分量数值' };
      const unit = String(portion.unit || '').trim().toLowerCase();
      if (!['g', 'ml'].includes(unit)) return { ok: false, message: '请选择分量单位' };
      const amount = parseNumber(amountText);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: '分量数值必须大于 0' };
      const grams = unit === 'g' ? amount : parseNumber(portion.grams);
      if (unit === 'ml' && Number.isFinite(grams) && grams <= 0) return { ok: false, message: '换算克数必须大于 0' };
      const normalizedName = normalizeText(portionName);
      if (seenPortionNames.has(normalizedName)) return { ok: false, message: '同一食品的分量名称不能重复' };
      seenPortionNames.add(normalizedName);
      portions.push({ name: portionName, amount, unit, grams: Number.isFinite(grams) ? grams : null, isDefault: portion.isDefault === true });
    }

    if (portions.filter((portion) => portion.isDefault).length > 1) {
      return { ok: false, message: '最多只能设置一个默认分量' };
    }

    if (!name) return { ok: false, message: '请输入食物名称' };
    if (![calories, protein, fat, carbs].every((value) => Number.isFinite(value) && value >= 0)) {
      return { ok: false, message: '营养值请输入大于等于 0 的数字' };
    }

    return {
      ok: true,
      payload: {
        name,
        name_en: privateForm.name_en.trim() || null,
        brand: privateForm.brand.trim() || null,
        category: privateForm.category || '其他',
        intakeTypes: privateForm.intakeTypes || [],
        default_quantity: 100,
        unit: 'g',
        calories,
        protein,
        fat,
        carbs,
        notes: privateForm.notes.trim() || null,
        portions,
      },
    };
  };

  const validatePublicForm = () => {
    const name = publicForm.name.trim();
    const brand = publicForm.brand.trim();
    const notes = publicForm.notes.trim();
    const calories = parseNumber(publicForm.calories);
    const protein = parseNumber(publicForm.protein);
    const fat = parseNumber(publicForm.fat);
    const carbs = parseNumber(publicForm.carbs);

    if (!name) return { ok: false, message: '请输入食物名称' };
    if (![calories, protein, fat, carbs].every((value) => Number.isFinite(value) && value >= 0)) {
      return { ok: false, message: '营养值请输入大于等于 0 的数字' };
    }
    if (!notes) {
      return { ok: false, message: '请填写营养信息来源。' };
    }

    return {
      ok: true,
      payload: {
        name,
        brand: brand || null,
        image_url: publicForm.image_url.trim() || null,
        default_quantity: 100,
        unit: 'g',
        calories,
        protein,
        fat,
        carbs,
        notes,
        is_active: Boolean(publicForm.is_active),
      },
    };
  };

  const resetPrivateForm = () => {
    setPrivateForm(emptyPrivateForm());
  };

  const addPrivatePortion = () => {
    setPrivateForm((prev) => ({
      ...prev,
      portions: [...(prev.portions || []), emptyPrivatePortion()],
    }));
  };

  const updatePrivatePortion = (index, key, value) => {
    setPrivateForm((prev) => ({
      ...prev,
      portions: (prev.portions || []).map((portion, portionIndex) => (
        portionIndex === index
          ? {
            ...portion,
            [key]: value,
            ...(key === 'unit' && value === 'ml' && portion.unit !== 'ml' ? { grams: '' } : {}),
            ...(key === 'unit' && value === 'g' ? { grams: portion.amount || '' } : {}),
          }
          : portion
      )),
    }));
  };

  const setPrivateDefaultPortion = (index) => {
    setPrivateForm((prev) => ({
      ...prev,
      portions: (prev.portions || []).map((portion, portionIndex) => ({
        ...portion,
        isDefault: portionIndex === index,
      })),
    }));
  };

  const removePrivatePortion = (index) => {
    setPrivateForm((prev) => ({
      ...prev,
      portions: (() => {
        const remaining = (prev.portions || []).filter((_, portionIndex) => portionIndex !== index);
        return remaining.length ? remaining : [emptyPrivatePortion()];
      })(),
    }));
  };

  const togglePrivateIntakeType = (value) => {
    setPrivateForm((prev) => ({
      ...prev,
      intakeTypes: prev.intakeTypes.includes(value)
        ? prev.intakeTypes.filter((item) => item !== value)
        : [...prev.intakeTypes, value],
    }));
  };

  const resetPublicForm = () => {
    setPublicForm(emptyPublicForm());
  };

  const hasPublicDuplicate = (payload, ignoreId = null) => {
    const targetName = normalizeText(payload.name);
    const targetBrand = normalizeText(payload.brand || '');
    return (publicFoods || []).some((food) => {
      if (ignoreId && food.id === ignoreId) return false;
      return normalizeText(food.name) === targetName && normalizeText(food.brand || '') === targetBrand;
    });
  };

  const reloadFoods = async () => {
    if (!user?.id) return;
    await Promise.allSettled([
      refreshFoods(user.id),
      loadPublicFoods(user.id),
    ]);
  };

  const handleCreatePrivateFood = async () => {
    if (!user?.id) {
      toast.error('请先登录后再添加食物');
      return;
    }

    const validation = validatePrivateForm();
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    setSubmitting(true);
    const { error } = await foodService.savePersonalFood(validation.payload);
    setSubmitting(false);

    if (error) {
      toast.error(`创建失败: ${error.message || '请稍后重试'}`);
      return;
    }

    await refreshFoods(user.id);
    showSuccess('已添加到我的食物库');
    setCreateOpen(false);
    resetPrivateForm();
  };

  const openEditPrivateDialog = (food) => {
    const loadedPortions = (food.portions || []).map((portion) => ({
      id: portion.id,
      name: portion.name || '',
      amount: String(portion.amount ?? portion.grams ?? ''),
      unit: portion.unit || 'g',
      grams: portion.grams == null ? '' : String(portion.grams),
      isDefault: portion.isDefault === true,
    }));
    setEditingFoodId(food.id);
    setPrivateForm({
      name: food.name || '',
      name_en: food.name_en || food.nameEn || '',
      brand: food.brand || '',
      category: food.primary_category || food.category || '其他',
      intakeTypes: food.intake_types || food.intakeTypes || [],
      calories: String(food.calories ?? food.cal100 ?? 0),
      protein: String(food.protein ?? food.p100 ?? 0),
      fat: String(food.fat ?? food.f100 ?? 0),
      carbs: String(food.carbs ?? food.c100 ?? 0),
      notes: food.notes || '',
      portions: loadedPortions.length ? loadedPortions : [emptyPrivatePortion()],
    });
    setEditOpen(true);
  };

  const closeEditPrivateDialog = () => {
    setEditOpen(false);
    setEditingFoodId(null);
    resetPrivateForm();
  };

  const handleUpdatePrivateFood = async () => {
    if (!user?.id || !editingFoodId) {
      toast.error('无法更新该食物');
      return;
    }

    const validation = validatePrivateForm();
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    setSubmitting(true);
    const { error } = await foodService.savePersonalFood({ id: editingFoodId, ...validation.payload });
    setSubmitting(false);

    if (error) {
      toast.error(`更新失败: ${error.message || '请稍后重试'}`);
      return;
    }

    await refreshFoods(user.id);
    showSuccess('已更新私人食物');
    closeEditPrivateDialog();
  };

  const handleDeletePrivateFood = async (food) => {
    if (!user?.id || !food?.id) {
      toast.error('无法删除该食物');
      return;
    }

    const canDelete = food.user_id === user.id && food.visibility !== 'public';
    if (!canDelete) {
      toast.error('只能删除自己的私人食物');
      return;
    }

    const confirmed = window.confirm(`确定删除「${food.name || '该食物'}」吗？历史记录中的营养快照会继续保留。`);
    if (!confirmed) return;

    setSubmitting(true);
    const { error } = await foodService.deleteFood(food.id, user.id);
    setSubmitting(false);

    if (error) {
      toast.error(`删除失败: ${error.message || '请稍后重试'}`);
      return;
    }

    await refreshFoods(user.id);
    showSuccess('已删除私人食物');
  };

  const openCreatePublicDialog = () => {
    setPublicForm(emptyPublicForm());
    setEditingPublicFoodId(null);
    setPublicCreateOpen(true);
  };

  const openEditPublicDialog = (food) => {
    setEditingPublicFoodId(food.id);
    setPublicForm({
      name: food.name || '',
      brand: food.brand || '',
      calories: String(food.calories ?? food.cal100 ?? 0),
      protein: String(food.protein ?? food.p100 ?? 0),
      fat: String(food.fat ?? food.f100 ?? 0),
      carbs: String(food.carbs ?? food.c100 ?? 0),
      image_url: food.image_url || '',
      notes: food.notes || '',
      is_active: food.isActive !== false,
    });
    setPublicEditOpen(true);
  };

  const closePublicDialog = () => {
    setPublicCreateOpen(false);
    setPublicEditOpen(false);
    setEditingPublicFoodId(null);
    resetPublicForm();
  };

  const savePublicFood = async (mode) => {
    if (!isAdmin) {
      toast.error('你没有权限修改公共食品。');
      return;
    }

    const validation = validatePublicForm();
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    const duplicate = hasPublicDuplicate(validation.payload, mode === 'edit' ? editingPublicFoodId : null);
    if (duplicate) {
      toast.warning('公共食品库中可能已经存在相同名称和品牌的食品，请确认是否仍要新增。');
    }

    setPublicSubmitting(true);
    const action = mode === 'edit'
      ? updatePublicFood(editingPublicFoodId, validation.payload)
      : createPublicFood(validation.payload);
    const result = await action;
    setPublicSubmitting(false);

    if (!result?.success) {
      const message = result?.error?.message || result?.error || '请稍后重试';
      const normalizedMessage = String(message || '');
      if (/row-level security|new row violates row-level security|rls/i.test(normalizedMessage)) {
        toast.error('保存失败：数据库未授予当前账号管理员写入公共食品权限。请先执行 008 迁移，并确认 profiles.role/account_type/is_admin 或 app_admins 已正确配置。');
      } else if (/权限|permission|not allowed/i.test(normalizedMessage)) {
        toast.error('你没有权限修改公共食品。');
      } else {
        toast.error(`保存公共食品失败，请稍后重试。${message ? ` ${message}` : ''}`);
      }
      return;
    }

    await reloadFoods();
    showSuccess(mode === 'edit' ? '公共食品已更新' : '公共食品已新增');
    closePublicDialog();
  };

  const handleTogglePublicActive = async (food) => {
    if (!isAdmin) {
      toast.error('你没有权限修改公共食品。');
      return;
    }

    const confirmed = window.confirm(
      food.isActive
        ? '停用公共食品\n\n停用后，用户将不能再把该食品添加到新的饮食记录中。过去的历史记录不会受到影响。'
        : '确定要重新启用这个公共食品吗？'
    );
    if (!confirmed) return;

    setPublicSubmitting(true);
    const result = await setPublicFoodActive(food.id, !food.isActive);
    setPublicSubmitting(false);

    if (!result?.success) {
      const message = result?.error?.message || result?.error || '请稍后重试';
      const normalizedMessage = String(message || '');
      if (/row-level security|new row violates row-level security|rls/i.test(normalizedMessage)) {
        toast.error('状态更新失败：数据库未授予当前账号管理员写入公共食品权限。请先执行 008 迁移，并确认管理员字段已生效。');
      } else {
        toast.error(result?.error?.message || result?.error || '保存公共食品失败，请稍后重试。');
      }
      return;
    }

    await reloadFoods();
    showSuccess(food.isActive ? '公共食品已停用' : '公共食品已启用');
  };

  const renderPrivateFoodFields = () => (
    <div className="space-y-3 max-h-[68dvh] overflow-y-auto pr-1">
      <Input placeholder="食品名称（必填）" value={privateForm.name} onChange={(e) => updatePrivateForm('name', e.target.value)} data-testid="private-food-name" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input placeholder="英文名称（可选）" value={privateForm.name_en} onChange={(e) => updatePrivateForm('name_en', e.target.value)} />
        <Input placeholder="品牌（可选）" value={privateForm.brand} onChange={(e) => updatePrivateForm('brand', e.target.value)} data-testid="private-food-brand" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={privateForm.category} onChange={(e) => updatePrivateForm('category', e.target.value)} className="h-10 rounded-md border border-[#E5E5E0] bg-white px-3 text-sm text-[#2C332F]">
          {PRIVATE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-[#E5E5E0] bg-white px-3 py-2 text-xs text-[#5E6660]">
          {INTAKE_TYPES.map(([value, label]) => (
            <label key={value} className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={privateForm.intakeTypes.includes(value)} onChange={() => togglePrivateIntakeType(value)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-[#5E6660] mb-2">每100g营养</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Input type="number" placeholder="热量 kcal" value={privateForm.calories} onChange={(e) => updatePrivateForm('calories', e.target.value)} />
          <Input type="number" placeholder="蛋白 g" value={privateForm.protein} onChange={(e) => updatePrivateForm('protein', e.target.value)} />
          <Input type="number" placeholder="脂肪 g" value={privateForm.fat} onChange={(e) => updatePrivateForm('fat', e.target.value)} />
          <Input type="number" placeholder="碳水 g" value={privateForm.carbs} onChange={(e) => updatePrivateForm('carbs', e.target.value)} />
        </div>
      </div>
      <section className="rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] p-3" data-testid="private-portions-editor">
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-sm font-medium text-[#2C332F]">可用分量</p><p className="text-[11px] text-[#858C88] mt-0.5">没有分量时仍可按克记录</p></div>
          <Button type="button" variant="outline" onClick={addPrivatePortion} className="min-h-9">添加分量</Button>
        </div>
        <div className="mt-3 space-y-2">
          {(privateForm.portions || []).map((portion, index) => (
            <div key={portion.id || index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_188px_auto] sm:items-center">
              <Input className="min-w-0" placeholder="如：1个" value={portion.name} onChange={(e) => updatePrivatePortion(index, 'name', e.target.value)} aria-label={`分量名称 ${index + 1}`} />
              <div className="flex min-w-0 items-center gap-2">
                <Input className="min-w-0 flex-1" type="number" placeholder="数值" value={portion.amount ?? ''} onChange={(e) => updatePrivatePortion(index, 'amount', e.target.value)} aria-label={`分量数值 ${index + 1}`} />
                <select value={portion.unit || ''} onChange={(e) => updatePrivatePortion(index, 'unit', e.target.value)} className="h-10 w-[92px] shrink-0 rounded-md border border-[#E5E5E0] bg-white px-2 text-sm text-[#2C332F]" aria-label={`分量单位 ${index + 1}`}>
                  <option value="g">克 (g)</option>
                  <option value="ml">毫升 (ml)</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 sm:justify-start">
                <button type="button" onClick={() => setPrivateDefaultPortion(index)} className={`text-[11px] whitespace-nowrap ${portion.isDefault ? 'text-[#6B8067] font-medium' : 'text-[#858C88]'}`} aria-label={`设为默认分量 ${index + 1}`}>{portion.isDefault ? '默认' : '设默认'}</button>
                <button type="button" onClick={() => removePrivatePortion(index)} className="p-2 text-[#C76D5E]" aria-label={`删除分量 ${index + 1}`}>×</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <Textarea placeholder="备注（可选）" value={privateForm.notes} onChange={(e) => updatePrivateForm('notes', e.target.value)} />
    </div>
  );

  return (
    <div className="pb-32">
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">LIBRARY</p>
            <h1 className="text-[22px] font-medium text-[#2C332F] mt-1">食物数据库</h1>
            <p className="text-[12px] text-[#858C88] mt-1">公共食品 + 个人食品统一管理</p>
          </div>
          {activeTab === 'mine' ? <button
            data-testid="add-custom-food"
            onClick={() => setCreateOpen(true)}
            className="mt-1 w-9 h-9 rounded-full bg-[#2C332F] text-white flex items-center justify-center"
          >
            <Plus size={16} strokeWidth={1.8} />
          </button> : null}
        </div>
      </header>

      <div className="mx-5 mb-4 grid grid-cols-2 rounded-xl bg-[#ECEDE9] p-1" role="tablist" aria-label="食物库类型">
        <button type="button" role="tab" aria-selected={activeTab === 'public'} onClick={() => setActiveTab('public')} className={`min-h-10 rounded-lg text-sm ${activeTab === 'public' ? 'bg-white text-[#2C332F] shadow-sm' : 'text-[#6F7772]'}`}>公共食品</button>
        <button type="button" role="tab" aria-selected={activeTab === 'mine'} onClick={() => setActiveTab('mine')} className={`min-h-10 rounded-lg text-sm ${activeTab === 'mine' ? 'bg-white text-[#2C332F] shadow-sm' : 'text-[#6F7772]'}`}>我的食品</button>
      </div>

      {activeTab === 'public' ? <PublicFoodBrowser onCopied={async () => {
        setQuery('');
        setCat('全部');
        if (user?.id) await refreshFoods(user.id);
        setActiveTab('mine');
      }} /> : <>
      <div className="px-5 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858C88]" strokeWidth={1.5} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索食物"
            className="pl-9 h-11 bg-white border-[#E5E5E0] rounded-xl"
            data-testid="library-search-input"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" data-testid="library-categories">
          {FOOD_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              data-testid={`cat-${c}`}
              className={`px-3.5 py-1.5 rounded-full text-[12px] whitespace-nowrap border ${
                cat === c
                  ? 'bg-[#2C332F] text-white border-[#2C332F]'
                  : 'bg-white text-[#2C332F] border-[#E5E5E0]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {isAdmin ? (
        <section className="mt-5 px-5">
          <div className="rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">ADMIN</p>
                <h2 className="text-[16px] font-medium text-[#2C332F] mt-1">管理公共食品</h2>
                <p className="text-[12px] text-[#858C88] mt-1">新增、编辑、停用公共食品。备注必须标注营养来源。</p>
              </div>
              <Button onClick={openCreatePublicDialog} className="bg-[#6B8067] hover:bg-[#5a6d57]">
                新增公共食品
              </Button>
            </div>
            <Button
              variant="outline"
              className="mt-3 min-h-11"
              onClick={() => navigate('/library/review')}
            >
              公共食品审核
            </Button>

            <div className="mt-4 space-y-2" data-testid="admin-public-food-list">
              {adminPublicList.map((food) => (
                <PublicFoodCard
                  key={food.id}
                  food={food}
                  onEdit={openEditPublicDialog}
                  onToggleActive={handleTogglePublicActive}
                  submitting={publicSubmitting}
                />
              ))}

              {adminPublicList.length === 0 ? (
                <p className="text-center text-sm text-[#858C88] py-6">没有找到公共食品</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-4 px-5 space-y-2" data-testid="library-list">
        {list.map((f, index) => {
          const canEditPrivate = f.user_id === user?.id && f.visibility !== 'public';
          const isPublic = f.visibility === 'public';
          return (
            <div
              key={f.id || `${f.name}-${index}`}
              data-testid={`library-item-${f.id || index}`}
              className="rounded-2xl bg-white border border-[#E5E5E0] p-3.5 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13.5px] text-[#2C332F] break-words">{f.name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0EFE9] text-[#858C88]">
                    {isPublic ? '公共' : '个人'}
                  </span>
                  {!isPublic ? <span className="text-[10px] text-[#858C88]">仅自己可见，可修改</span> : null}
                  {f.isActive === false ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F4F4F2] text-[#858C88]">
                      已停用
                    </span>
                  ) : null}
                </div>
                {f.brand ? <p className="text-[11px] text-[#5E6660] mt-1">品牌：{f.brand}</p> : null}
                {isPublic && f.notes ? (
                  <p className="text-[11px] text-[#858C88] mt-1 line-clamp-2">来源：{f.notes}</p>
                ) : null}
                <p className="font-num text-[11px] text-[#858C88] mt-1 break-words">
                  每100g · P{f.p100 || 0} · F{f.f100 || 0} · C{f.c100 || 0}
                </p>
                <p className="text-[11px] text-[#858C88] mt-1">{f.portions?.length ? `${f.portions.length} 个可用分量` : '可按克记录'}</p>
                {f.sourcePublicFoodId ? <p className="mt-1 text-[11px] text-[#858C88]">复制自公共食品</p> : null}
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="font-num text-[15px] font-medium text-[#2C332F]">
                  {f.cal100 || 0} <span className="text-[10px] text-[#858C88] font-normal">kcal</span>
                </p>
                <div className="mt-1 flex items-center justify-end gap-3">
                  {!isPublic ? <button type="button" onClick={() => setSelectedPersonalFood(f)} className="min-h-10 text-[11px] text-[#5E6660]">查看详情</button> : null}
                  {canEditPrivate ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditPrivateDialog(f)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#6B8067] hover:text-[#5a6d57]"
                        data-testid={`edit-food-${f.id || index}`}
                        disabled={submitting}
                      >
                        <Pencil size={12} strokeWidth={1.8} /> 编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePrivateFood(f)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#C76D5E] hover:text-[#B85A4A]"
                        data-testid={`delete-food-${f.id || index}`}
                        disabled={submitting}
                      >
                        <Trash2 size={12} strokeWidth={1.8} /> 删除
                      </button>
                    </>
                  ) : null}
                  {isPublic && isAdmin ? (
                    <span className="text-[11px] text-[#858C88]">在上方管理公共食品</span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {list.length === 0 && (
          <p className="text-center text-sm text-[#858C88] py-8">食物库还是空的，请添加第一个食物</p>
        )}
      </div>
      </>}

      <Dialog open={createOpen} onOpenChange={(open) => (open ? setCreateOpen(true) : setCreateOpen(false))}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>添加自定义食物</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {renderPrivateFoodFields()}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>取消</Button>
              <Button onClick={handleCreatePrivateFood} disabled={submitting} className="bg-[#6B8067] hover:bg-[#5a6d57]">
                {submitting ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedPersonalFood)} onOpenChange={(open) => !open && setSelectedPersonalFood(null)}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>个人食品详情</DialogTitle></DialogHeader>
          {selectedPersonalFood ? <div className="space-y-4" data-testid="personal-food-detail">
            <div><span className="inline-flex rounded-full bg-[#F0EFE9] px-2 py-1 text-[10px] text-[#5E6660]">个人 · 仅自己可见</span><h2 className="mt-2 text-lg font-medium">{selectedPersonalFood.name}</h2>{selectedPersonalFood.nameEn ? <p className="mt-1 text-xs text-[#858C88]">{selectedPersonalFood.nameEn}</p> : null}{selectedPersonalFood.brand ? <p className="mt-1 text-xs text-[#5E6660]">品牌：{selectedPersonalFood.brand}</p> : null}</div>
            <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-[#F7F7F5] p-3">分类 <span className="float-right">{selectedPersonalFood.primaryCategory || '其他'}</span></div><div className="rounded-xl bg-[#F7F7F5] p-3">摄入类型 <span className="float-right">{selectedPersonalFood.intakeTypes?.length ? selectedPersonalFood.intakeTypes.join('、') : '未填写'}</span></div></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-[#F7F7F5] p-3">热量 <span className="float-right">{selectedPersonalFood.cal100} kcal</span></div>
              <div className="rounded-xl bg-[#F7F7F5] p-3">蛋白质 <span className="float-right">{selectedPersonalFood.p100} g</span></div>
              <div className="rounded-xl bg-[#F7F7F5] p-3">碳水 <span className="float-right">{selectedPersonalFood.c100} g</span></div>
              <div className="rounded-xl bg-[#F7F7F5] p-3">脂肪 <span className="float-right">{selectedPersonalFood.f100} g</span></div>
            </div>
            <section><h3 className="text-sm font-medium">个人别名</h3><p className="mt-1 text-xs text-[#858C88]">{selectedPersonalFood.aliases?.length ? selectedPersonalFood.aliases.join('、') : '暂无别名'}</p></section>
            <section><h3 className="text-sm font-medium">可用份量</h3>{selectedPersonalFood.portions?.length ? <ul className="mt-1 space-y-1 text-xs text-[#858C88]">{selectedPersonalFood.portions.map((portion) => <li key={portion.id}>{portion.name} · {portion.amount ?? portion.grams}{portion.unit === 'ml' ? 'ml' : 'g'}</li>)}</ul> : <p className="mt-1 text-xs text-[#858C88]">暂无标准份量，可按克记录</p>}</section>
            {selectedPersonalFood.sourcePublicFoodId ? <p className="text-xs text-[#858C88]">复制自公共食品</p> : null}
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { setSelectedPersonalFood(null); openEditPrivateDialog(selectedPersonalFood); }}>编辑</Button><Button variant="outline" className="flex-1 text-[#C76D5E]" onClick={() => { const food = selectedPersonalFood; setSelectedPersonalFood(null); void handleDeletePrivateFood(food); }}>删除</Button></div>
          </div> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => (open ? setEditOpen(true) : closeEditPrivateDialog())}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>修改私人食物</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {renderPrivateFoodFields()}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeEditPrivateDialog} disabled={submitting}>取消</Button>
              <Button onClick={handleUpdatePrivateFood} disabled={submitting} className="bg-[#6B8067] hover:bg-[#5a6d57]">
                {submitting ? '保存中...' : '保存修改'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={publicCreateOpen} onOpenChange={(open) => (open ? setPublicCreateOpen(true) : closePublicDialog())}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>新增公共食品</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input placeholder="食品名称" value={publicForm.name} onChange={(e) => updatePublicForm('name', e.target.value)} />
            <Input placeholder="品牌（可选）" value={publicForm.brand} onChange={(e) => updatePublicForm('brand', e.target.value)} />
            <Input type="number" placeholder="热量（每100g）" value={publicForm.calories} onChange={(e) => updatePublicForm('calories', e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" placeholder="蛋白" value={publicForm.protein} onChange={(e) => updatePublicForm('protein', e.target.value)} />
              <Input type="number" placeholder="脂肪" value={publicForm.fat} onChange={(e) => updatePublicForm('fat', e.target.value)} />
              <Input type="number" placeholder="碳水" value={publicForm.carbs} onChange={(e) => updatePublicForm('carbs', e.target.value)} />
            </div>
            <Input placeholder="图片 URL（可选）" value={publicForm.image_url} onChange={(e) => updatePublicForm('image_url', e.target.value)} />
            <Textarea
              placeholder="请注明数据来源，例如产品包装、品牌官网或食品数据库。"
              value={publicForm.notes}
              onChange={(e) => updatePublicForm('notes', e.target.value)}
              rows={4}
            />
            <div className="flex items-center justify-between rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] px-4 py-3">
              <div>
                <p className="text-[13px] text-[#2C332F]">是否启用</p>
                <p className="text-[11px] text-[#858C88] mt-0.5">停用后不会出现在新搜索结果中</p>
              </div>
              <Switch checked={publicForm.is_active} onCheckedChange={(checked) => updatePublicForm('is_active', checked)} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closePublicDialog} disabled={publicSubmitting}>取消</Button>
              <Button onClick={() => savePublicFood('create')} disabled={publicSubmitting} className="bg-[#6B8067] hover:bg-[#5a6d57]">
                {publicSubmitting ? '保存中...' : '保存公共食品'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={publicEditOpen} onOpenChange={(open) => (open ? setPublicEditOpen(true) : closePublicDialog())}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>编辑公共食品</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input placeholder="食品名称" value={publicForm.name} onChange={(e) => updatePublicForm('name', e.target.value)} />
            <Input placeholder="品牌（可选）" value={publicForm.brand} onChange={(e) => updatePublicForm('brand', e.target.value)} />
            <Input type="number" placeholder="热量（每100g）" value={publicForm.calories} onChange={(e) => updatePublicForm('calories', e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" placeholder="蛋白" value={publicForm.protein} onChange={(e) => updatePublicForm('protein', e.target.value)} />
              <Input type="number" placeholder="脂肪" value={publicForm.fat} onChange={(e) => updatePublicForm('fat', e.target.value)} />
              <Input type="number" placeholder="碳水" value={publicForm.carbs} onChange={(e) => updatePublicForm('carbs', e.target.value)} />
            </div>
            <Input placeholder="图片 URL（可选）" value={publicForm.image_url} onChange={(e) => updatePublicForm('image_url', e.target.value)} />
            <Textarea
              placeholder="请注明数据来源，例如产品包装、品牌官网或食品数据库。"
              value={publicForm.notes}
              onChange={(e) => updatePublicForm('notes', e.target.value)}
              rows={4}
            />
            <div className="flex items-center justify-between rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] px-4 py-3">
              <div>
                <p className="text-[13px] text-[#2C332F]">是否启用</p>
                <p className="text-[11px] text-[#858C88] mt-0.5">停用后不会出现在新搜索结果中</p>
              </div>
              <Switch checked={publicForm.is_active} onCheckedChange={(checked) => updatePublicForm('is_active', checked)} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closePublicDialog} disabled={publicSubmitting}>取消</Button>
              <Button onClick={() => savePublicFood('edit')} disabled={publicSubmitting} className="bg-[#6B8067] hover:bg-[#5a6d57]">
                {publicSubmitting ? '保存中...' : '保存修改'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
