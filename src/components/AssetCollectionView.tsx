import React, { useMemo, useState } from 'react';
import { Clock3, LockKeyhole, Plus, RefreshCw, Search, Star, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Asset, AssetCategory, AssetStatus, Folder } from '../types';
import { CategoryNav } from './CategoryNav';
import { AssetCard } from './AssetCard';
import type { VaultTabType } from './PersonalVaultHeader';

interface AssetCollectionViewProps {
  activeView: 'feed' | 'vault';
  activeVaultTab: VaultTabType;
  filteredAssets: Asset[];
  folders: Folder[];
  isLoadingAssets: boolean;
  searchQuery: string;
  selectedCategory: AssetCategory | 'all';
  selectedTag: string | null;
  selectedFolderId: string | 'all' | 'unassigned';
  selectedStatusFilter: AssetStatus | 'all';
  visibilityFilter: 'all' | 'public' | 'private';
  categoryCounts: Record<string, number>;
  bookmarkedAssetIds: string[];
  likedAssetIds: string[];
  currentUserId: string | undefined;
  onSelectCategory: (category: AssetCategory | 'all') => void;
  onClearTag: () => void;
  onVisibilityFilterChange: (filter: 'all' | 'public' | 'private') => void;
  onOpenAsset: (asset: Asset) => void;
  onLike: (assetId: string) => void;
  onBookmark: (assetId: string) => void;
  onFork: (asset: Asset) => void;
  onReport: (asset: Asset) => void;
  onRestore: (assetId: string) => void;
  onPermanentDelete: (assetId: string) => void;
  onSelectTag: (tag: string) => void;
  onOpenMoveToFolder: (asset: Asset) => void;
  onCreateAsset: () => void;
}

const getEmptyStateIcon = (activeView: 'feed' | 'vault', activeVaultTab: VaultTabType): LucideIcon => {
  if (activeView === 'feed') return Search;
  if (activeVaultTab === 'trash') return Trash2;
  if (activeVaultTab === 'bookmarks') return Star;
  if (activeVaultTab === 'recent') return Clock3;
  return LockKeyhole;
};

export const AssetCollectionView: React.FC<AssetCollectionViewProps> = ({
  activeView,
  activeVaultTab,
  filteredAssets,
  folders,
  isLoadingAssets,
  searchQuery,
  selectedCategory,
  selectedTag,
  selectedFolderId,
  selectedStatusFilter,
  visibilityFilter,
  categoryCounts,
  bookmarkedAssetIds,
  likedAssetIds,
  currentUserId,
  onSelectCategory,
  onClearTag,
  onVisibilityFilterChange,
  onOpenAsset,
  onLike,
  onBookmark,
  onFork,
  onReport,
  onRestore,
  onPermanentDelete,
  onSelectTag,
  onOpenMoveToFolder,
  onCreateAsset
}) => {
  const [sortMode, setSortMode] = useState<'latest' | 'title'>('latest');

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    filteredAssets.forEach(asset => asset.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'th')).slice(0, 12);
  }, [filteredAssets]);

  const sortedAssets = useMemo(() => {
    if (sortMode === 'title') {
      return [...filteredAssets].sort((a, b) => a.title.localeCompare(b.title, 'th'));
    }
    return filteredAssets;
  }, [filteredAssets, sortMode]);

  return (
    <div className="cv-collection-view">
      <CategoryNav
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        selectedTag={selectedTag}
        onClearTag={onClearTag}
        categoryCounts={categoryCounts}
        activeView={activeView}
        visibilityFilter={visibilityFilter}
        onVisibilityFilterChange={onVisibilityFilterChange}
      />

      <div className="cv-feed-toolbar">
        <div className="flex items-center gap-2 min-w-0">
          <span className="cv-results-count">{sortedAssets.length} รายการ</span>
          {selectedTag && (
            <span className="cv-active-filter">#{selectedTag}</span>
          )}
        </div>
        {activeView === 'feed' && (
          <label className="cv-sort-control">
            <span>เรียง</span>
            <select value={sortMode} onChange={event => setSortMode(event.target.value as 'latest' | 'title')} aria-label="เรียงลำดับผลงาน">
              <option value="latest">ล่าสุด</option>
              <option value="title">ชื่อ A–Z</option>
            </select>
          </label>
        )}
      </div>

      {activeView === 'feed' && availableTags.length > 0 && (
        <div className="cv-tag-discovery" aria-label="ค้นหาจากแท็ก">
          <span className="cv-tag-heading">แท็กน่าสนใจ</span>
          <div className="cv-tag-list">
            {availableTags.map(tag => (
              <button
                key={tag}
                type="button"
                aria-pressed={selectedTag === tag}
                onClick={() => selectedTag === tag ? onClearTag() : onSelectTag(tag)}
                className={`cv-tag-chip ${selectedTag === tag ? 'is-active' : ''}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoadingAssets ? (
        <div className="cv-state-box">
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">กำลังโหลดข้อมูลคลังผลงาน...</p>
        </div>
      ) : sortedAssets.length > 0 ? (
        <div className="cv-asset-grid">
          {sortedAssets.map(asset => {
            const folder = folders.find(item => item.id === asset.folderId);
            return (
              <AssetCard
                key={asset.id}
                asset={asset}
                folderName={folder?.name}
                folderIcon={folder?.icon}
                onClick={onOpenAsset}
                onLike={onLike}
                onBookmark={onBookmark}
                onFork={onFork}
                onReport={onReport}
                onRestore={onRestore}
                onPermanentDelete={onPermanentDelete}
                onSelectCategory={onSelectCategory}
                onSelectTag={onSelectTag}
                onOpenMoveToFolder={onOpenMoveToFolder}
                isOwner={asset.userId === currentUserId}
                isBookmarked={bookmarkedAssetIds.includes(asset.id)}
                isLiked={likedAssetIds.includes(asset.id)}
                isTrashMode={activeVaultTab === 'trash'}
              />
            );
          })}
        </div>
      ) : (
        <div className="cv-empty-state">
          <div className="cv-empty-orbit" aria-hidden="true">
            {React.createElement(getEmptyStateIcon(activeView, activeVaultTab), { className: 'cv-empty-state-icon', strokeWidth: 1.7 })}
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {searchQuery
              ? `ไม่พบผลงานที่ตรงกับ "${searchQuery}"`
              : selectedTag
              ? `ไม่พบผลงานที่มีแท็ก #${selectedTag}`
              : activeView === 'vault'
              ? (activeVaultTab === 'trash'
                  ? 'ไม่มีผลงานในถังขยะ'
                  : activeVaultTab === 'bookmarks'
                  ? 'ยังไม่มีผลงานที่บันทึกไว้ในบุ๊กมาร์ก'
                  : activeVaultTab === 'recent'
                  ? 'ยังไม่มีประวัติการดูผลงานล่าสุด'
                  : 'ยังไม่มีผลงานในคลังส่วนตัวหรือโฟลเดอร์นี้')
              : 'ยังไม่มีผลงานในหมวดหมู่นี้'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {activeView === 'vault'
              ? (activeVaultTab === 'trash'
                  ? 'ผลงานที่คุณย้ายลงถังขยะจะปรากฏที่นี่เพื่อกู้คืนได้ทุกเมื่อ'
                  : activeVaultTab === 'bookmarks'
                  ? 'กดบันทึกผลงานโปรดจากฟีดสาธารณะเพื่อเก็บไว้อ่านได้ที่นี่'
                  : 'เริ่มต้นสร้างโปรไฟล์บอท, บันทึก System Prompt หรือโค้ด UI ชิ้นแรกของคุณได้ทันที')
              : 'เป็นคนแรกที่สร้างสรรค์และแชร์ความรู้ลงในหมวดหมู่นี้!'}
          </p>
          {activeView === 'vault' && activeVaultTab === 'my_assets' && (
            <div className="pt-2">
              <button
                onClick={onCreateAsset}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-sm shadow-purple-200 dark:shadow-purple-950 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>สร้างผลงานใหม่</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
