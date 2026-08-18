import React from 'react';
import { CATEGORIES } from '../lib/constants';
import { AssetCategory } from '../types';
import { Sparkles, Globe, Lock, SlidersHorizontal, Tag as TagIcon, X } from 'lucide-react';

interface CategoryNavProps {
  selectedCategory: AssetCategory | 'all';
  onSelectCategory: (cat: AssetCategory | 'all') => void;
  selectedTag?: string | null;
  onClearTag?: () => void;
  categoryCounts: Record<string, number>;
  activeView: 'feed' | 'vault';
  visibilityFilter: 'all' | 'public' | 'private';
  onVisibilityFilterChange: (v: 'all' | 'public' | 'private') => void;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  selectedCategory,
  onSelectCategory,
  selectedTag,
  onClearTag,
  categoryCounts,
  activeView,
  visibilityFilter,
  onVisibilityFilterChange
}) => {
  const categoryKeys = Object.keys(CATEGORIES) as AssetCategory[];

  return (
    <div className="py-4 space-y-3">
      {/* Category Pills Slider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none no-scrollbar">
        
        {/* All Button */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all ${
            selectedCategory === 'all' && !selectedTag
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-700 hover:text-purple-700 dark:hover:text-purple-300 border border-purple-100/80 dark:border-purple-900/50'
          }`}
        >
          <span>✨ ทั้งหมด</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            selectedCategory === 'all' && !selectedTag 
              ? 'bg-slate-800 dark:bg-slate-200 text-purple-200 dark:text-purple-900' 
              : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300'
          }`}>
            {categoryCounts['all'] || 0}
          </span>
        </button>

        {/* Specific Categories */}
        {categoryKeys.map((catKey) => {
          const meta = CATEGORIES[catKey];
          const isSelected = selectedCategory === catKey;
          const count = categoryCounts[catKey] || 0;

          return (
            <button
              key={catKey}
              onClick={() => onSelectCategory(catKey)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-purple-600 dark:bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-200 dark:shadow-purple-950 font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-slate-700 hover:text-purple-700 dark:hover:text-purple-300 border-purple-100/80 dark:border-purple-900/50'
              }`}
            >
              <span>{meta.emoji}</span>
              <span>{meta.name}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                isSelected ? 'bg-purple-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tag Filter Notice if filtered by tag */}
      {selectedTag && (
        <div className="flex items-center justify-between p-2.5 bg-pink-50/80 dark:bg-pink-950/50 rounded-2xl border border-pink-200 dark:border-pink-900 text-xs text-pink-800 dark:text-pink-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <TagIcon className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
            <span>กำลังกรองตามแท็ก: <strong>#{selectedTag}</strong></span>
          </div>
          {onClearTag && (
            <button
              onClick={onClearTag}
              className="p-1 text-pink-600 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/60 rounded-full flex items-center gap-1 font-bold text-[11px]"
            >
              <X className="w-3.5 h-3.5" />
              <span>ล้างการกรอง</span>
            </button>
          )}
        </div>
      )}

      {/* Vault Sub-Filters (When viewing personal vault) */}
      {activeView === 'vault' && (
        <div className="flex items-center justify-between bg-purple-50/60 dark:bg-slate-800/60 p-2 rounded-2xl border border-purple-100/70 dark:border-purple-900/50">
          <div className="flex items-center gap-1.5 text-xs text-purple-900 dark:text-purple-200 font-medium px-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>ความเป็นส่วนตัว:</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onVisibilityFilterChange('all')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                visibilityFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => onVisibilityFilterChange('public')}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                visibilityFilter === 'public'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300'
              }`}
            >
              <Globe className="w-3 h-3 text-indigo-500" />
              <span>สาธารณะ (Public)</span>
            </button>
            <button
              onClick={() => onVisibilityFilterChange('private')}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                visibilityFilter === 'private'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300'
              }`}
            >
              <Lock className="w-3 h-3 text-pink-500" />
              <span>ส่วนตัว (Private)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
