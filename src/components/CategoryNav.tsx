import React from 'react';
import { Globe, Lock, SlidersHorizontal, Tag as TagIcon, X } from 'lucide-react';
import { CATEGORIES } from '../lib/constants';
import type { AssetCategory } from '../types';

const CATEGORY_EMOJIS: Record<AssetCategory, string> = {
  character: '🎭',
  lore: '📖',
  ui_code: '💻',
  prompts: '✨',
  collab: '🤝',
  app_data: '🧩'
};

interface CategoryNavProps {
  selectedCategory: AssetCategory | 'all';
  onSelectCategory: (cat: AssetCategory | 'all') => void;
  selectedTag?: string | null;
  onClearTag?: () => void;
  categoryCounts: Record<string, number>;
  activeView: 'feed' | 'vault';
  visibilityFilter: 'all' | 'public' | 'private';
  onVisibilityFilterChange: (value: 'all' | 'public' | 'private') => void;
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
    <div className="cv-category-nav">
      <div className="cv-category-scroll" aria-label="กรองตามหมวดหมู่">
        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          aria-pressed={selectedCategory === 'all' && !selectedTag}
          className={`cv-category-pill ${selectedCategory === 'all' && !selectedTag ? 'is-active' : ''}`}
        >
          <span className="cv-category-emoji" aria-hidden="true">✦</span>
          <span>ทั้งหมด</span>
          <span className="cv-pill-count">{categoryCounts.all || 0}</span>
        </button>

        {categoryKeys.map(category => {
          const meta = CATEGORIES[category];
          const isSelected = selectedCategory === category;
          return (
            <button
              type="button"
              key={category}
              onClick={() => onSelectCategory(category)}
              aria-pressed={isSelected}
              className={`cv-category-pill ${isSelected ? 'is-active' : ''}`}
            >
              <span className="cv-category-emoji" aria-hidden="true">{CATEGORY_EMOJIS[category]}</span>
              <span>{meta.name}</span>
              <span className="cv-pill-count">{categoryCounts[category] || 0}</span>
            </button>
          );
        })}
      </div>

      {selectedTag && (
        <div className="cv-selected-tag" role="status">
          <div className="flex items-center gap-2 min-w-0">
            <TagIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">กำลังกรองตามแท็ก: <strong>#{selectedTag}</strong></span>
          </div>
          {onClearTag && (
            <button type="button" onClick={onClearTag} className="cv-clear-tag">
              <X className="w-3.5 h-3.5" />
              <span>ล้าง</span>
            </button>
          )}
        </div>
      )}

      {activeView === 'vault' && (
        <div className="cv-visibility-filter">
          <div className="flex items-center gap-2 shrink-0 text-xs font-semibold text-purple-900 dark:text-purple-200">
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="hidden sm:inline">การมองเห็น</span>
          </div>
          <div className="cv-visibility-options">
            <button type="button" onClick={() => onVisibilityFilterChange('all')} className={visibilityFilter === 'all' ? 'is-active' : ''}>ทั้งหมด</button>
            <button type="button" onClick={() => onVisibilityFilterChange('public')} className={visibilityFilter === 'public' ? 'is-active' : ''}><Globe className="w-3 h-3" />สาธารณะ</button>
            <button type="button" onClick={() => onVisibilityFilterChange('private')} className={visibilityFilter === 'private' ? 'is-active' : ''}><Lock className="w-3 h-3" />ส่วนตัว</button>
          </div>
        </div>
      )}
    </div>
  );
};
