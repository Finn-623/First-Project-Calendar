import React, { useState, useMemo } from 'react';
import { FOOD_LIBRARY, FOOD_CATEGORIES } from '../mockData';
import { Search, Plus } from 'lucide-react';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export const FoodLibraryPage = () => {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('全部');

  const list = useMemo(() => {
    return FOOD_LIBRARY.filter((f) => {
      const matchQ = f.name.includes(query.trim());
      const matchC = cat === '全部' || f.category === cat;
      return matchQ && matchC;
    });
  }, [query, cat]);

  return (
    <div className="pb-32">
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">LIBRARY</p>
            <h1 className="text-[22px] font-medium text-[#2C332F] mt-1">食物数据库</h1>
          </div>
          <button
            data-testid="add-custom-food"
            onClick={() => toast.info('自定义食物功能即将上线')}
            className="mt-1 w-9 h-9 rounded-full bg-[#2C332F] text-white flex items-center justify-center"
          >
            <Plus size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="px-5">
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

        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1" data-testid="library-categories">
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

      <div className="mt-4 px-5 space-y-2" data-testid="library-list">
        {list.map((f) => (
          <div
            key={f.id}
            data-testid={`library-item-${f.id}`}
            className="rounded-2xl bg-white border border-[#E5E5E0] p-3.5 flex items-center justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13.5px] text-[#2C332F]">{f.name}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0EFE9] text-[#858C88]">
                  {f.category}
                </span>
              </div>
              <p className="font-num text-[11px] text-[#858C88] mt-1">
                每100g · P{f.p100} · F{f.f100} · C{f.c100}
              </p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="font-num text-[15px] font-medium text-[#2C332F]">
                {f.cal100} <span className="text-[10px] text-[#858C88] font-normal">kcal</span>
              </p>
            </div>
          </div>
        ))}

        {list.length === 0 && (
          <p className="text-center text-sm text-[#858C88] py-8">没有匹配的食物</p>
        )}
      </div>
    </div>
  );
};
