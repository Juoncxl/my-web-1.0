import React, { useMemo, useState } from 'react';
import { ArrowLeft, Clock3, Folder as FolderIcon, LockKeyhole, MoreHorizontal, Plus, RefreshCw, Search, Star, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Asset, AssetCategory, AssetStatus, Folder } from '../types';
import { CATEGORIES, FOLDER_COLOR_PRESETS, STATUS_PRESETS } from '../lib/constants';
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
  onEditAsset: (asset: Asset) => void;
  onDeleteAsset: (asset: Asset) => void;
  onSelectStatusFilter: (status: AssetStatus | 'all') => void;
  onLike: (assetId: string) => void;
  onBookmark: (assetId: string) => void;
  onFork: (asset: Asset) => void;
  onReport: (asset: Asset) => void;
  onRestore: (assetId: string) => void;
  onPermanentDelete: (assetId: string) => void;
  onSelectTag: (tag: string) => void;
  onSelectFolder: (folderId: string | 'all' | 'unassigned') => void;
  onOpenMoveToFolder: (asset: Asset) => void;
  onOpenFolderManager: () => void;
  onCreateAsset: () => void;
}

const getEmptyStateIcon = (activeView: 'feed' | 'vault', activeVaultTab: VaultTabType): LucideIcon => {
  if (activeView === 'feed') return Search;
  if (activeVaultTab === 'folders') return FolderIcon;
  if (activeVaultTab === 'trash') return Trash2;
  if (activeVaultTab === 'bookmarks') return Star;
  if (activeVaultTab === 'recent') return Clock3;
  return LockKeyhole;
};

const isImageIcon = (icon?: string) => Boolean(icon && (icon.startsWith('data:image') || icon.startsWith('http')));

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
  onEditAsset,
  onDeleteAsset,
  onLike,
  onBookmark,
  onFork,
  onReport,
  onRestore,
  onPermanentDelete,
  onSelectTag,
  onSelectFolder,
  onOpenMoveToFolder,
  onOpenFolderManager,
  onCreateAsset,
  onSelectStatusFilter
}) => {
  const [sortMode, setSortMode] = useState<'latest' | 'title'>('latest');

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    filteredAssets.forEach(asset => asset.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'th')).slice(0, 12);
  }, [filteredAssets]);

  const sortedAssets = useMemo(() => {
    if (sortMode === 'title') return [...filteredAssets].sort((a, b) => a.title.localeCompare(b.title, 'th'));
    return filteredAssets;
  }, [filteredAssets, sortMode]);

  const selectedFolder = folders.find(folder => folder.id === selectedFolderId);
  const isFolderOverview = activeView === 'vault' && activeVaultTab === 'folders' && !selectedFolder;
  const shouldShowAssetControls = !isFolderOverview;

  const renderVaultFilterBar = () => {
    if (activeView !== 'vault' || isFolderOverview) return null;
    const showOrganizationFilters = activeVaultTab === 'my_assets' || activeVaultTab === 'folders';
    const activeFilterCount = [
      showOrganizationFilters && selectedFolderId !== 'all',
      showOrganizationFilters && selectedStatusFilter !== 'all',
      selectedCategory !== 'all',
      showOrganizationFilters && visibilityFilter !== 'all',
      Boolean(selectedTag)
    ].filter(Boolean).length;

    return (
      <div className="cv-vault-filter-bar" aria-label="ตัวกรองคลังของฉัน">
        <div className="cv-vault-filter-controls">
          {showOrganizationFilters && (
            <label className="cv-vault-filter-select">
              <span>โฟลเดอร์</span>
              <select value={selectedFolderId} onChange={event => onSelectFolder(event.target.value as string | 'all' | 'unassigned')} aria-label="กรองตามโฟลเดอร์">
                <option value="all">ทั้งหมด</option>
                <option value="unassigned">นอกโฟลเดอร์</option>
                {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>
          )}
          {showOrganizationFilters && (
            <label className="cv-vault-filter-select">
              <span>สถานะ</span>
              <select value={selectedStatusFilter} onChange={event => onSelectStatusFilter(event.target.value as AssetStatus | 'all')} aria-label="กรองตามสถานะ">
                <option value="all">ทั้งหมด</option>
                {(Object.keys(STATUS_PRESETS) as AssetStatus[]).map(status => <option key={status} value={status}>{STATUS_PRESETS[status].name}</option>)}
              </select>
            </label>
          )}
          <label className="cv-vault-filter-select">
            <span>หมวดหมู่</span>
            <select value={selectedCategory} onChange={event => onSelectCategory(event.target.value as AssetCategory | 'all')} aria-label="กรองตามหมวดหมู่">
              <option value="all">ทั้งหมด</option>
              {(Object.keys(CATEGORIES) as AssetCategory[]).map(category => <option key={category} value={category}>{CATEGORIES[category].name}</option>)}
            </select>
          </label>
          {showOrganizationFilters && (
            <label className="cv-vault-filter-select">
              <span>การมองเห็น</span>
              <select value={visibilityFilter} onChange={event => onVisibilityFilterChange(event.target.value as 'all' | 'public' | 'private')} aria-label="กรองตามการมองเห็น">
                <option value="all">ทั้งหมด</option>
                <option value="public">สาธารณะ</option>
                <option value="private">ส่วนตัว</option>
              </select>
            </label>
          )}
          <label className="cv-vault-filter-select cv-vault-filter-sort">
            <span>เรียง</span>
            <select value={sortMode} onChange={event => setSortMode(event.target.value as 'latest' | 'title')} aria-label="เรียงลำดับผลงาน">
              <option value="latest">ล่าสุด</option>
              <option value="title">ชื่อ A–Z</option>
            </select>
          </label>
        </div>
        <div className="cv-vault-active-filters" aria-live="polite">
          {activeFilterCount > 0 && <span className="cv-vault-filter-summary">กรองอยู่ {activeFilterCount}</span>}
          {selectedFolderId !== 'all' && selectedFolderId !== 'unassigned' && selectedFolder && <button type="button" onClick={() => onSelectFolder('all')}>โฟลเดอร์: {selectedFolder.name} ×</button>}
          {selectedFolderId === 'unassigned' && <button type="button" onClick={() => onSelectFolder('all')}>นอกโฟลเดอร์ ×</button>}
          {selectedStatusFilter !== 'all' && <button type="button" onClick={() => onSelectStatusFilter('all')}>สถานะ: {STATUS_PRESETS[selectedStatusFilter].name} ×</button>}
          {selectedCategory !== 'all' && <button type="button" onClick={() => onSelectCategory('all')}>หมวดหมู่: {CATEGORIES[selectedCategory].name} ×</button>}
          {showOrganizationFilters && visibilityFilter !== 'all' && <button type="button" onClick={() => onVisibilityFilterChange('all')}>การมองเห็น: {visibilityFilter === 'public' ? 'สาธารณะ' : 'ส่วนตัว'} ×</button>}
          {selectedTag && <button type="button" onClick={onClearTag}>แท็ก: #{selectedTag} ×</button>}
        </div>
      </div>
    );
  };

  const renderFolderOverview = () => {
    if (folders.length === 0) {
      return (
        <div className="cv-empty-state">
          <div className="cv-empty-orbit" aria-hidden="true"><FolderIcon className="cv-empty-state-icon" strokeWidth={1.7} /></div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">ยังไม่มีโฟลเดอร์</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">สร้างคอลเลกชันแรกเพื่อจัดระเบียบผลงานของคุณ</p>
          <button type="button" onClick={onOpenFolderManager} className="cv-create-button mt-2 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold">
            <Plus className="h-4 w-4" />สร้างโฟลเดอร์
          </button>
        </div>
      );
    }

    return (
      <div className="cv-folder-grid" aria-label="โฟลเดอร์ของฉัน">
        {folders.map(folder => {
          const colorMeta = FOLDER_COLOR_PRESETS.find(color => color.id === folder.color) || FOLDER_COLOR_PRESETS[0];
          return (
            <article key={folder.id} className="cv-folder-card" style={{ '--cv-folder-accent': colorMeta.swatch } as React.CSSProperties}>
              <button type="button" onClick={() => onSelectFolder(folder.id)} className="cv-folder-card-main" aria-label={`เปิดโฟลเดอร์ ${folder.name}`}>
                <span className={`cv-folder-card-icon ${colorMeta.bg}`}>
                  {isImageIcon(folder.icon) ? <img src={folder.icon} alt="" referrerPolicy="no-referrer" /> : <span>{folder.icon || '📁'}</span>}
                </span>
                <span className="cv-folder-card-copy">
                  <strong>{folder.name}</strong>
                  <span>{folder.assetsCount || 0} ผลงาน</span>
                </span>
              </button>
              <button type="button" onClick={onOpenFolderManager} className="cv-folder-card-menu" aria-label={`จัดการโฟลเดอร์ ${folder.name}`} title="จัดการโฟลเดอร์">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </article>
          );
        })}
        <button type="button" onClick={onOpenFolderManager} className="cv-folder-create-tile">
          <span><Plus className="h-5 w-5" /></span>
          <strong>สร้างโฟลเดอร์</strong>
          <small>จัดกลุ่มผลงานให้เป็นระเบียบ</small>
        </button>
      </div>
    );
  };

  const emptyTitle = searchQuery
    ? `ไม่พบผลงานที่ตรงกับ "${searchQuery}"`
    : selectedTag
      ? `ไม่พบผลงานที่มีแท็ก #${selectedTag}`
      : activeView === 'vault'
        ? activeVaultTab === 'trash'
          ? 'ถังขยะว่าง'
          : activeVaultTab === 'bookmarks'
            ? 'ยังไม่มีผลงานที่บันทึกไว้'
            : activeVaultTab === 'recent'
              ? 'ยังไม่มีประวัติการเปิดดู'
              : selectedFolder
                ? 'โฟลเดอร์นี้ยังไม่มีผลงาน'
                : 'ยังไม่มีผลงานในคลัง'
        : 'ยังไม่มีผลงานในหมวดหมู่นี้';

  const emptyDescription = activeView === 'vault'
    ? activeVaultTab === 'trash'
      ? 'ผลงานที่ลบจะอยู่ที่นี่เพื่อให้คุณกู้คืนหรือลบถาวร'
      : activeVaultTab === 'bookmarks'
        ? 'ผลงานที่คุณบันทึกไว้จะแสดงที่นี่'
        : activeVaultTab === 'recent'
          ? 'ผลงานที่คุณเปิดดูล่าสุดจะแสดงที่นี่'
          : selectedFolder
            ? 'ย้ายผลงานเข้ามาในโฟลเดอร์นี้จากเมนูเพิ่มเติมบนการ์ด'
            : 'เริ่มสร้างผลงานชิ้นแรกของคุณได้เลย'
    : 'ผลงานใหม่ในหมวดนี้จะปรากฏที่นี่';

  return (
    <div className="cv-collection-view">
      {isFolderOverview ? (
        <>
          <div className="cv-collection-heading">
            <div>
              <h2>โฟลเดอร์ของฉัน</h2>
              <p>รวมพื้นที่จัดเก็บผลงานตามโปรเจกต์หรือไอเดีย</p>
            </div>
            <span className="cv-section-count">{folders.length} โฟลเดอร์</span>
          </div>
          {renderFolderOverview()}
        </>
      ) : (
        <>
          {selectedFolder && (
            <div className="cv-folder-open-heading">
              <button type="button" onClick={() => onSelectFolder('all')} className="cv-back-button">
                <ArrowLeft className="h-4 w-4" />กลับไปโฟลเดอร์
              </button>
              <div className="cv-folder-open-title">
                <span>{isImageIcon(selectedFolder.icon) ? <img src={selectedFolder.icon} alt="" referrerPolicy="no-referrer" /> : selectedFolder.icon || '📁'}</span>
                <div><h2>{selectedFolder.name}</h2><p>{selectedFolder.assetsCount || 0} ผลงานในโฟลเดอร์นี้</p></div>
              </div>
            </div>
          )}

          {shouldShowAssetControls && (
            <>
              {activeView === 'feed' ? (
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
              ) : renderVaultFilterBar()}

              <div className="cv-feed-toolbar">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="cv-results-count">{sortedAssets.length} รายการ</span>
                  {selectedTag && <span className="cv-active-filter">#{selectedTag}</span>}
                </div>
                {activeView === 'feed' && <label className="cv-sort-control">
                  <span>เรียง</span>
                  <select value={sortMode} onChange={event => setSortMode(event.target.value as 'latest' | 'title')} aria-label="เรียงลำดับผลงาน">
                    <option value="latest">ล่าสุด</option>
                    <option value="title">ชื่อ A–Z</option>
                  </select>
                </label>}
              </div>

              {activeView === 'feed' && availableTags.length > 0 && (
                <div className="cv-tag-discovery" aria-label="ค้นหาจากแท็ก">
                  <span className="cv-tag-heading">แท็กน่าสนใจ</span>
                  <div className="cv-tag-list">
                    {availableTags.map(tag => <button key={tag} type="button" aria-pressed={selectedTag === tag} onClick={() => selectedTag === tag ? onClearTag() : onSelectTag(tag)} className={`cv-tag-chip ${selectedTag === tag ? 'is-active' : ''}`}>#{tag}</button>)}
                  </div>
                </div>
              )}
            </>
          )}

          {isLoadingAssets ? (
            <div className="cv-state-box"><RefreshCw className="h-8 w-8 animate-spin text-purple-500" /><p className="text-sm font-semibold text-slate-600 dark:text-slate-400">กำลังโหลดผลงาน...</p></div>
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
                    onEdit={asset.userId === currentUserId ? onEditAsset : undefined}
                    onDelete={asset.userId === currentUserId ? onDeleteAsset : undefined}
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
              <div className="cv-empty-orbit" aria-hidden="true">{React.createElement(getEmptyStateIcon(activeView, activeVaultTab), { className: 'cv-empty-state-icon', strokeWidth: 1.7 })}</div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">{emptyTitle}</h3>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{emptyDescription}</p>
              {activeView === 'vault' && activeVaultTab === 'my_assets' && <button type="button" onClick={onCreateAsset} className="cv-create-button mt-2 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"><Plus className="h-4 w-4" />สร้างผลงาน</button>}
            </div>
          )}
        </>
      )}
    </div>
  );
};
