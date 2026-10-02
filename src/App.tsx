import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import type { Asset, AssetCategory, AssetStatus } from './types';
import { isWorkOwnedBy } from './lib/publicCreatorIdentity';
import {
  canCreateOwnedAsset
} from './lib/accessPolicy';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { SettingsModal } from './components/SettingsModal';
import { VaultTabType } from './components/PersonalVaultHeader';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AlertCircle, X } from 'lucide-react';
import confetti from 'canvas-confetti';

const brandMicroMarkUrl = new URL('./assets/brand/brand-micro-mark.svg', import.meta.url).href;
import { useAssetData } from './hooks/useAssetData';
import { hydrateAssetDetailInBackground, openAssetDetailImmediately, type DetailHydrationState } from './hooks/assetDetailRead';
import { useFolderData } from './hooks/useFolderData';
import { useEngagementData } from './hooks/useEngagementData';
import { useRecentlyViewed } from './hooks/useRecentlyViewed';
import { useAssetFilters } from './hooks/useAssetFilters';
import { useAssetModalState } from './hooks/useAssetModalState';
import { useAssetActions } from './hooks/useAssetActions';
import { isKnownAppPath } from './lib/appRoutes';
import { NotFoundPage } from './pages/NotFoundPage';
import { WORK_NOT_FOUND_MESSAGE } from './lib/publicApiErrors';
import { getLegacyProfileRedirect, parseCanonicalProfileLocation, resolveProfileWorksReadScope } from './lib/profileRouting';
import { getCanonicalProfilePath } from './lib/profileIdentity';
import type { CreatorWorkDraft } from './components/creator/CreatorWorkWorkspace';
import { serializeCreatorWorkDraft } from './components/creator/creatorWorkSerializer';
import { isGoogleWorksReadBackend } from './data/cxlDataService';
import { CATEGORIES } from './lib/constants';
import { getWorkStatusDisplay, type WorkStatusValue } from './lib/workStatus';

const DiscoverPage = React.lazy(() => import('./pages/DiscoverPage').then(module => ({ default: module.DiscoverPage })));
const CollabSchedulePage = React.lazy(() => import('./pages/CollabSchedulePage').then(module => ({ default: module.CollabSchedulePage })));
const CreatorSpacePage = React.lazy(() => import('./pages/CreatorSpacePage').then(module => ({ default: module.CreatorSpacePage })));
const WorkDetailModal = React.lazy(() => import('./components/WorkDetailModal').then(module => ({ default: module.WorkDetailModal })));
const AIAssistantModal = React.lazy(() => import('./components/AIAssistantModal').then(module => ({ default: module.AIAssistantModal })));
const FolderManagerModal = React.lazy(() => import('./components/FolderManagerModal').then(module => ({ default: module.FolderManagerModal })));
const MoveToFolderModal = React.lazy(() => import('./components/MoveToFolderModal').then(module => ({ default: module.MoveToFolderModal })));
const ReportModal = React.lazy(() => import('./components/ReportModal').then(module => ({ default: module.ReportModal })));
const CreatorWorkWorkspace = React.lazy(() => import('./components/creator/CreatorWorkWorkspace').then(module => ({ default: module.CreatorWorkWorkspace })));

function WorkDetailSummaryFallback({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const cover = asset.previewImage || asset.previewImages?.[0] || '';
  const categoryLabel = CATEGORIES[asset.category]?.name || asset.category;
  const statusLabel = getWorkStatusDisplay(asset).name;
  return <div className="work-detail-backdrop" data-work-detail-loading-shell>
    <section className="work-detail-modal" role="dialog" aria-modal="true" aria-labelledby="work-detail-loading-title" aria-busy="true">
      <header className="work-detail-header work-detail-header-actions-only">
        <div className="work-detail-header-actions">
          <button type="button" onClick={onClose} aria-label="ปิดรายละเอียดผลงาน"><X aria-hidden="true" /></button>
        </div>
      </header>
      <div className="work-detail-body">
        <div className="work-detail-grid">
          <div className="work-detail-media-column" data-work-detail-section="media">
            <div className={`work-detail-cover ${cover ? 'has-image' : 'has-fallback'}`}>
              {cover ? <img src={cover} alt={`ภาพปก ${asset.title}`} referrerPolicy="no-referrer" />
                : <div className="work-detail-mark">{asset.icon?.type === 'image' ? <img src={asset.icon.value} alt="" /> : <span>{asset.icon?.value || '✦'}</span>}</div>}
            </div>
          </div>
          <div className="work-detail-copy">
            <div className="work-detail-meta"><span>{categoryLabel}</span><span>{statusLabel}</span></div>
            <h2 id="work-detail-loading-title">{asset.title}</h2>
            <div className="work-detail-creator"><div className="work-detail-avatar">{asset.authorAvatar ? <img src={asset.authorAvatar} alt="" /> : 'CX'}</div><strong>{asset.authorName || 'ผู้สร้างผลงาน'}</strong></div>
            {asset.shortDescription && <section className="work-detail-summary"><strong>คำอธิบายสั้น</strong><p>{asset.shortDescription}</p></section>}
          </div>
        </div>
        <p role="status" aria-live="polite">กำลังเปิดรายละเอียดผลงาน…</p>
      </div>
    </section>
  </div>;
}

function MainApp() {
  const {
    currentUser, 
    isAuthOpen,
    setIsAuthOpen,
    openAuthModal,
    isOnboardingOpen,
    setIsOnboardingOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isLoading: authLoading
  } = useAuth();
  const profileRoute = parseCanonicalProfileLocation(window.location.pathname, window.location.search);
  const creatorSlug = profileRoute?.slug || null;
  const legacyProfileRedirect = getLegacyProfileRedirect(window.location.pathname, window.location.search, currentUser);
  const workRoute = window.location.pathname.match(/^\/work\/([^/]+)(?:\/(edit))?\/?$/i);
  const isScheduleRoute = /^\/schedule\/?$/i.test(window.location.pathname);
  const isNotFoundRoute = !isKnownAppPath(window.location.pathname);

  // Navigation State
  const [activeView, setActiveView] = useState<'feed' | 'vault'>('feed');
  const [activeVaultTab, setActiveVaultTab] = useState<VaultTabType>('my_assets');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'all'>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<WorkStatusValue | 'all'>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all' | 'unassigned'>('all');
  const [, setRouteVersion] = useState(0);

  const navigate = useCallback((path: string) => {
    const next = new URL(path, window.location.origin);
    const nextPath = `${next.pathname}${next.search}${next.hash}`;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextPath === currentPath) return;
    window.history.pushState({}, '', nextPath);
    setRouteVersion(version => version + 1);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  useEffect(() => {
    const rerenderForRoute = () => setRouteVersion(version => version + 1);
    window.addEventListener('popstate', rerenderForRoute);
    return () => window.removeEventListener('popstate', rerenderForRoute);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const [operationError, setOperationError] = useState<string | null>(null);
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null);
  const reportOperationError = useCallback((message: string) => {
    setOperationError(message);
  }, []);
  const resolvedUserId = authLoading ? undefined : currentUser?.id;
  const assetLoadOptions = useMemo(() => {
    if (creatorSlug) {
      // Profile cards and widgets only need the lightweight presentation
      // columns. Opening or editing a Work hydrates that one full row on
      // demand, so an owner profile with legacy long-form payloads does not
      // download every payload during its initial render.
      const profileWorksScope = resolveProfileWorksReadScope(creatorSlug, currentUser);
      const includeDeleted = profileRoute?.requestedTab === 'trash';
      return profileWorksScope.type === 'owner'
        ? { userId: profileWorksScope.userId, includeDeleted, detail: 'summary', limit: 100 } as const
        : { creatorSlug: profileWorksScope.creatorSlug, includeDeleted: false, detail: 'summary', limit: 100 } as const;
    }
    if (workRoute?.[1]) {
      let assetId = workRoute[1];
      try { assetId = decodeURIComponent(assetId); } catch { /* keep the raw route value */ }
      return { assetId, detail: 'full', limit: 1 } as const;
    }
    if (activeView === 'vault' && currentUser?.id) {
      // The Vault list also hydrates one Work on demand. Pulling every legacy
      // long-form payload here recreates the same egress spike as the Feed.
      return { userId: currentUser.id, includeDeleted: true, detail: 'summary', limit: 100 } as const;
    }
    return { publicOnly: true, detail: 'summary', limit: 48 } as const;
  }, [activeView, creatorSlug, currentUser, profileRoute?.requestedTab, workRoute?.[1]]);

  // A creator route must wait for Auth restoration once so it can choose the
  // owner query immediately instead of doing an anonymous read followed by a
  // second owner read. The public Feed remains independent and starts at once.
  const indexedOwnerSearch = isGoogleWorksReadBackend && 'userId' in assetLoadOptions && Boolean(assetLoadOptions.userId) && assetLoadOptions.detail === 'summary';
  const effectiveAssetLoadOptions = useMemo(() => indexedOwnerSearch
    ? { ...assetLoadOptions, search: debouncedSearchQuery.trim() || undefined }
    : assetLoadOptions,
  [assetLoadOptions, debouncedSearchQuery, indexedOwnerSearch]);
  const detailOpenScopeKey = JSON.stringify([currentUser?.id || '', effectiveAssetLoadOptions]);
  const latestDetailOpenScopeKey = useRef(detailOpenScopeKey);
  const detailOpenSequence = useRef(0);
  latestDetailOpenScopeKey.current = detailOpenScopeKey;

  const assetLoadingEnabled = !creatorSlug || !authLoading;

  const {
    assets,
    isLoadingAssets,
    refreshAssets,
    loadAssetDetail,
    createAsset,
    updateAsset,
    softDeleteAsset,
    restoreAsset,
    permanentDeleteAsset,
    forkAsset,
    moveAsset,
    updateAssetLikeCount,
    clearFolderAssignments
  } = useAssetData(currentUser, setAssetLoadError, assetLoadingEnabled, effectiveAssetLoadOptions);
  const {
    folders,
    isLoadingFolders,
    refreshFolders,
    createFolder,
    updateFolder,
    deleteFolder
  } = useFolderData(resolvedUserId, reportOperationError);
  const {
    bookmarkedAssetIds,
    likedAssetIds,
    toggleBookmark,
    toggleLike
  } = useEngagementData(resolvedUserId, reportOperationError);
  // This release has one authenticated Owner and read-only public visitors.
  // Likes, bookmarks, and forks require visitor accounts, so keep them out of
  // the active product surface while the Google owner backend is in use.
  const engagementActionsAvailable = false;
  const { recentlyViewedIds, trackRecentlyViewed } = useRecentlyViewed();
  // A /work/:id link whose Work was deleted, made private, or never existed.
  // A real load failure (network, server) keeps the normal error banner instead.
  const missingWorkId = workRoute?.[1] && workRoute[1] !== 'new' && workRoute[2] !== 'edit' ? workRoute[1] : null;
  const isMissingWork = Boolean(missingWorkId && !authLoading && !isLoadingAssets
    && !assets.some(asset => asset.id === missingWorkId || encodeURIComponent(asset.id) === missingWorkId)
    && (!assetLoadError || assetLoadError === WORK_NOT_FOUND_MESSAGE));
  const visibleOperationError = operationError || (isMissingWork ? null : assetLoadError);

  const {
    viewingAsset,
    editingAssetId,
    editingAsset,
    isEditorOpen,
    reportingAsset,
    movingAsset,
    openAssetView,
    closeAssetView,
    openEditEditor,
    closeEditor,
    openCreateEditor,
    openReport,
    closeReport,
    openMoveToFolder,
    closeMoveToFolder
  } = useAssetModalState(assets);
  const [detailHydration, setDetailHydration] = useState<DetailHydrationState>(null);

  const hydrateDetail = useCallback((assetId: string) => {
    void hydrateAssetDetailInBackground<Asset>({
      assetId,
      sequence: detailOpenSequence,
      scopeKey: latestDetailOpenScopeKey.current,
      getCurrentScopeKey: () => latestDetailOpenScopeKey.current,
      load: assetId => loadAssetDetail(assetId, { suppressError: true }),
      setState: setDetailHydration,
      clearState: () => setDetailHydration(current => current?.assetId === assetId ? null : current)
    });
  }, [loadAssetDetail]);

  // Simple UI-only state stays local to App; asset selections live in the
  // focused asset modal hook above.
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false);
  const [trashConfirmationAsset, setTrashConfirmationAsset] = useState<Asset | null>(null);
  const [aiContext, setAiContext] = useState<{ type: string; context: string } | null>(null);

  useEffect(() => {
    const refreshCloudData = () => {
      void refreshAssets();
      void refreshFolders();
    };
    window.addEventListener('creator-vault-cloud-data-changed', refreshCloudData);
    return () => window.removeEventListener('creator-vault-cloud-data-changed', refreshCloudData);
  }, [refreshAssets, refreshFolders]);

  useEffect(() => {
    if (!currentUser && activeView === 'vault') {
      setActiveView('feed');
    }
  }, [activeView, currentUser]);

  // Compatibility routes retain useful old bookmarks without leaving Vault or
  // Creator Space as user-facing destinations.
  useEffect(() => {
    if (legacyProfileRedirect) window.location.replace(legacyProfileRedirect);
  }, [legacyProfileRedirect]);

  // Track recently viewed items while keeping the selected asset canonical.
  const handleOpenAssetView = useCallback((asset: Asset) => {
    openAssetDetailImmediately(asset.id, openAssetView, trackRecentlyViewed, hydrateDetail);
  }, [hydrateDetail, openAssetView, trackRecentlyViewed]);

  const handleViewChange = useCallback((view: 'feed' | 'vault') => {
    if (view === 'feed') {
      if (workRoute?.[1]) {
        closeAssetView();
        navigate('/');
      }
      if (isScheduleRoute) navigate('/');
      setActiveView('feed');
      setSelectedTag(null);
      return;
    }
    if (authLoading) return;
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    setActiveView(view);
    setSelectedTag(null);
  }, [authLoading, closeAssetView, currentUser, isScheduleRoute, navigate, openAuthModal, workRoute?.[1]]);

  const handleVaultTabChange = useCallback((tab: VaultTabType) => {
    setActiveVaultTab(tab);
    if (tab === 'folders') setSelectedFolderId('all');
  }, []);

  // All new Create Work entry points open the one canonical workspace. The
  // repository decides whether the resulting mutation is local QA or cloud.
  const handleOpenCreateModal = useCallback(() => {
    if (authLoading) return;
    if (!canCreateOwnedAsset(currentUser)) {
      openAuthModal('signup');
      return;
    }
    openCreateEditor();
  }, [authLoading, currentUser, openAuthModal, openCreateEditor]);

  const handleSaveCreatorWork = useCallback(async (draft: CreatorWorkDraft, context?: { requestId: string; expectedRevision?: number }) => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนบันทึกผลงาน' };
    const serialized = serializeCreatorWorkDraft({
      ...draft,
      imagePromptToolModel: draft.contentCanvas.imagePrompt.toolModel
    });

    if (editingAssetId) {
      const result = await updateAsset(editingAssetId, {
        ...serialized
      }, context ? { requestId: context.requestId, expectedRevision: context.expectedRevision } : undefined);
      if (result.data) {
        return { success: true };
      }
      return { success: false, error: result.error || 'แก้ไขผลงานไม่สำเร็จ' };
    }

    const result = await createAsset({
      ...serialized,
      deletedAt: null,
      likesCount: 0,
      forkCount: 0,
      forkedFromId: null,
      forkedFromAuthor: null,
      linkedAssetIds: [],
      versions: []
    }, context ? { requestId: context.requestId } : undefined);
    if (result.data) {
      navigate(getCanonicalProfilePath(currentUser, '?tab=works'));
      return { success: true };
    }
    return { success: false, error: result.error || 'สร้างผลงานไม่สำเร็จ' };
  }, [createAsset, currentUser, editingAssetId, navigate, updateAsset]);

  const handleOpenAIModal = useCallback(() => {
    setAiContext(null);
    setIsAIOpen(true);
  }, []);

  const handleOpenMoveToFolder = useCallback((asset: Asset) => {
    openMoveToFolder(asset.id);
  }, [openMoveToFolder]);

  const handleEditVaultAsset = useCallback(async (asset: Asset, onEditorClose?: () => void) => {
    const detailedAsset = await loadAssetDetail(asset.id);
    if (!detailedAsset) return;
    openEditEditor(asset.id, onEditorClose);
  }, [loadAssetDetail, openEditEditor]);

  const handleCloseEditor = useCallback(() => {
    closeEditor();
    if (workRoute?.[2] === 'edit' && workRoute[1]) {
      const detailPath = `${window.location.pathname.replace(/\/edit\/?$/i, '')}${window.location.search}${window.location.hash}`;
      navigate(detailPath);
    }
  }, [closeEditor, navigate, workRoute?.[1], workRoute?.[2]]);

  const handleOpenCreatorProfile = useCallback(() => {
    if (!currentUser) return;
    navigate(getCanonicalProfilePath(currentUser));
  }, [currentUser, navigate]);

  // Work create, detail, and edit continue to share the existing canonical
  // workspace/modal implementations. Routes simply select the correct mode.
  useEffect(() => {
    if (!workRoute || authLoading) return;
    const [, workId, mode] = workRoute;
    if (workId === 'new') {
      handleOpenCreateModal();
      return;
    }
    if (mode === 'edit') {
      if (!currentUser) { openAuthModal('login'); return; }
      if (assets.some(asset => asset.id === workId)) openEditEditor(workId);
      return;
    }
    if (assets.some(asset => asset.id === workId)) openAssetView(workId);
  }, [assets, authLoading, currentUser, handleOpenCreateModal, openAssetView, openAuthModal, openEditEditor, workRoute?.[1], workRoute?.[2]]);

  const handleForkSuccess = useCallback(() => {
    if (currentUser) navigate(getCanonicalProfilePath(currentUser, '?tab=works'));
    confetti({ particleCount: 35, spread: 55, origin: { y: 0.6 } });
  }, [currentUser, navigate]);

  const handleBookmarkSuccess = useCallback(() => {
    confetti({
      particleCount: 20,
      spread: 40,
      origin: { y: 0.8 },
      colors: ['#F59E0B', '#EC4899', '#8B5CF6']
    });
  }, []);

  const {
    handleSoftDeleteAsset,
    handleRestoreAsset,
    handlePermanentDeleteAsset,
    handleToggleBookmark,
    handleForkAsset,
    handleMoveToFolder,
    handleLikeAsset
  } = useAssetActions({
    currentUser,
    editingAssetId,
    bookmarkedAssetIds,
    openAuthModal,
    reportOperationError,
    clearOperationError: () => setOperationError(null),
    createAsset,
    updateAsset,
    softDeleteAsset,
    restoreAsset,
    permanentDeleteAsset,
    forkAsset,
    moveAsset,
    toggleBookmark,
    toggleLike,
    updateAssetLikeCount,
    onAssetDeleted: () => closeAssetView(),
    onCreateSuccess: closeEditor,
    onUpdateSuccess: closeEditor,
    onForkSuccess: handleForkSuccess,
    onBookmarkSuccess: handleBookmarkSuccess
  });

  const handleDeleteVaultAsset = useCallback((asset: Asset) => {
    setTrashConfirmationAsset(asset);
  }, []);

  const handleConfirmVaultTrash = useCallback(() => {
    if (!trashConfirmationAsset) return;
    const assetId = trashConfirmationAsset.id;
    setTrashConfirmationAsset(null);
    void handleSoftDeleteAsset(assetId);
  }, [handleSoftDeleteAsset, trashConfirmationAsset]);

  // Folder CRUD
  const handleCreateFolder = async (name: string, icon = '📁', color = 'purple'): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await createFolder(name, icon, color);
      if (res.data) {
        setOperationError(null);
        return true;
      }
      setOperationError(res.error || 'สร้างโฟลเดอร์ไม่สำเร็จ');
    } catch (e) {
      console.error('Create folder error:', e);
      setOperationError('สร้างโฟลเดอร์ไม่สำเร็จ');
    }
    return false;
  };

  const handleUpdateFolder = async (id: string, name: string, icon?: string, color?: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await updateFolder(id, name, icon, color);
      if (res.data) {
        setOperationError(null);
        return true;
      }
      setOperationError(res.error || 'แก้ไขโฟลเดอร์ไม่สำเร็จ');
    } catch (e) {
      console.error('Update folder error:', e);
      setOperationError('แก้ไขโฟลเดอร์ไม่สำเร็จ');
    }
    return false;
  };

  const handleDeleteFolder = async (id: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await deleteFolder(id);
      if (res.success) {
        setOperationError(null);
        clearFolderAssignments(id);
        if (selectedFolderId === id) {
          setSelectedFolderId('all');
        }
        return true;
      }
      setOperationError(res.error || 'ลบโฟลเดอร์ไม่สำเร็จ');
    } catch (e) {
      console.error('Delete folder error:', e);
      setOperationError('ลบโฟลเดอร์ไม่สำเร็จ');
    }
    return false;
  };

  const handleOpenReport = useCallback((asset: Asset) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    openReport(asset.id);
  }, [currentUser, openAuthModal, openReport]);

  const { filteredAssets, categoryCounts, platformCounts, vaultStats, folderAssetCounts } = useAssetFilters({
    assets,
    folders,
    activeView,
    activeVaultTab,
    selectedCategory,
    selectedPlatform,
    selectedTag,
    selectedFolderId,
    selectedStatusFilter,
    visibilityFilter,
    searchQuery,
    searchAlreadyApplied: indexedOwnerSearch,
    bookmarkedAssetIds,
    recentlyViewedIds,
    currentUserId: currentUser?.id
  });
  const foldersWithCounts = folders.map(folder => ({
    ...folder,
    assetsCount: folderAssetCounts[folder.id] || 0
  }));

  const collectionProps = {
    activeView,
    activeVaultTab,
    filteredAssets,
    allAssets: assets,
    folders: foldersWithCounts,
    isLoadingAssets,
    searchQuery,
    selectedCategory,
    selectedPlatform,
    selectedTag,
    selectedFolderId,
    selectedStatusFilter,
    visibilityFilter,
    categoryCounts,
    platformCounts,
    bookmarkedAssetIds,
    likedAssetIds,
    currentUserId: currentUser?.id,
    currentUser,
    onSelectCategory: (category: AssetCategory | 'all') => { setSelectedCategory(category); setSelectedPlatform(null); },
    onSelectPlatform: setSelectedPlatform,
    onClearTag: () => setSelectedTag(null),
    onVisibilityFilterChange: setVisibilityFilter,
    onSelectStatusFilter: setSelectedStatusFilter,
    onOpenAsset: handleOpenAssetView,
    onEditAsset: handleEditVaultAsset,
    onDeleteAsset: handleDeleteVaultAsset,
    onLike: engagementActionsAvailable ? handleLikeAsset : undefined,
    onBookmark: engagementActionsAvailable ? handleToggleBookmark : undefined,
    onFork: engagementActionsAvailable ? handleForkAsset : undefined,
    onReport: handleOpenReport,
    onRestore: handleRestoreAsset,
    onPermanentDelete: handlePermanentDeleteAsset,
    onSelectTag: setSelectedTag,
    onSelectFolder: setSelectedFolderId,
    onOpenMoveToFolder: handleOpenMoveToFolder,
    onOpenFolderManager: () => setIsFolderManagerOpen(true),
    onCreateAsset: handleOpenCreateModal
  };

  return (
    <div className="cv-app-shell min-h-screen flex flex-col text-slate-800 dark:text-slate-100 transition-colors duration-200">
      <React.Suspense fallback={<main className="cv-main-container flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6" aria-busy="true">กำลังโหลดพื้นที่ของคุณ...</main>}>
      {creatorSlug ? (
        <CreatorSpacePage
          slug={creatorSlug}
          onCreateAsset={handleOpenCreateModal}
          onEditAsset={handleEditVaultAsset}
          onOpenAuth={() => openAuthModal('login')}
          onOpenFolderManager={() => setIsFolderManagerOpen(true)}
          onOpenMoveToFolder={handleOpenMoveToFolder}
          onMoveAssetToFolder={handleMoveToFolder}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
          allKnownAssets={assets}
          knownFolders={foldersWithCounts}
          isLoadingAssets={isLoadingAssets}
          isLoadingFolders={isLoadingFolders}
          bookmarkedAssetIds={bookmarkedAssetIds}
          likedAssetIds={likedAssetIds}
          recentlyViewedIds={recentlyViewedIds}
          onTrackRecentlyViewed={trackRecentlyViewed}
          onLike={engagementActionsAvailable ? handleLikeAsset : undefined}
          onBookmark={engagementActionsAvailable ? handleToggleBookmark : undefined}
          onDeleteAsset={handleDeleteVaultAsset}
          onRestoreAsset={handleRestoreAsset}
          onPermanentDeleteAsset={handlePermanentDeleteAsset}
        />
      ) : (
        <>
          {/* Top Header */}
          <Header
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeView={activeView}
            onViewChange={handleViewChange}
            onOpenCreateModal={handleOpenCreateModal}
            onOpenAuthModal={() => openAuthModal('login')}
            onOpenSignUpModal={() => openAuthModal('signup')}
            onOpenSettingsModal={() => setIsSettingsOpen(true)}
          />

          {/* Main Container */}
          <main className="cv-main-container flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {visibleOperationError && (
              <div className="mb-4 p-3 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{visibleOperationError}</span>
                <button type="button" onClick={() => { setOperationError(null); setAssetLoadError(null); }} aria-label="ปิดข้อความแจ้งเตือน" className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {isNotFoundRoute
              ? <NotFoundPage onGoHome={() => { navigate('/'); window.scrollTo({ top: 0 }); }} />
              : isMissingWork
              ? <NotFoundPage title={WORK_NOT_FOUND_MESSAGE} description="ผลงานนี้อาจถูกลบ ถูกตั้งเป็นส่วนตัว หรือลิงก์ไม่ถูกต้อง" onGoHome={() => { navigate('/'); window.scrollTo({ top: 0 }); }} />
              : isScheduleRoute
              ? <CollabSchedulePage assets={assets} isLoading={isLoadingAssets} isOwner={Boolean(currentUser)} onBack={() => navigate('/')} onOpenAsset={handleOpenAssetView} />
              : <DiscoverPage collectionProps={collectionProps} onOpenSchedule={() => { navigate('/schedule'); window.scrollTo({ top: 0 }); }} />}
          </main>

          <footer className="cv-footer border-t py-6 mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <img src={brandMicroMarkUrl} alt="" aria-hidden="true" className="w-4 h-4 object-contain" />
                <span className="font-bold text-slate-700 dark:text-slate-300">CXL Studio</span>
                <span>— คลังไอเดียสำหรับนักเขียนและครีเอเตอร์</span>
              </div>
              <span>เก็บและจัดการผลงานของคุณไว้ในที่เดียว</span>
            </div>
          </footer>
        </>
      )}
      </React.Suspense>

      {/* Modals */}
      <React.Suspense fallback={viewingAsset ? <WorkDetailSummaryFallback asset={viewingAsset} onClose={closeAssetView} /> : null}>
      {viewingAsset && <WorkDetailModal
        asset={viewingAsset}
        detailHydration={detailHydration?.assetId === viewingAsset.id
          ? { status: detailHydration.status, onRetry: () => hydrateDetail(viewingAsset.id) }
          : undefined}
        isOpen={!!viewingAsset}
        onClose={closeAssetView}
        preserveHeaderNavigation={Boolean(workRoute?.[1])}
        onEdit={asset => { closeAssetView(); openEditEditor(asset.id); }}
        onDelete={handleSoftDeleteAsset}
        onPermanentDelete={handlePermanentDeleteAsset}
        onRestore={handleRestoreAsset}
        onLike={engagementActionsAvailable ? handleLikeAsset : undefined}
        onBookmark={engagementActionsAvailable ? handleToggleBookmark : undefined}
        onFork={engagementActionsAvailable ? handleForkAsset : undefined}
        onReport={handleOpenReport}
        onSelectLinkedAsset={(linkedId) => {
          const target = assets.find(a => a.id === linkedId);
          if (target) handleOpenAssetView(target);
        }}
        allAssets={assets}
        folders={foldersWithCounts}
        onMoveToFolder={handleOpenMoveToFolder}
        isOwner={isWorkOwnedBy(viewingAsset, currentUser)}
        creatorProfile={isWorkOwnedBy(viewingAsset, currentUser) ? currentUser : null}
        isBookmarked={viewingAsset ? bookmarkedAssetIds.includes(viewingAsset.id) : false}
        isLiked={viewingAsset ? likedAssetIds.includes(viewingAsset.id) : false}
        isTrashMode={activeVaultTab === 'trash'}
      />}

      {reportingAsset && <ReportModal
        isOpen={!!reportingAsset}
        onClose={closeReport}
        asset={reportingAsset}
      />}

      {isFolderManagerOpen && <FolderManagerModal
        isOpen={isFolderManagerOpen}
        onClose={() => setIsFolderManagerOpen(false)}
        folders={folders}
        onCreateFolder={handleCreateFolder}
        onUpdateFolder={handleUpdateFolder}
        onDeleteFolder={handleDeleteFolder}
      />}

      {movingAsset && <MoveToFolderModal
        isOpen={!!movingAsset}
        onClose={closeMoveToFolder}
        asset={movingAsset}
        folders={foldersWithCounts}
        onMoveToFolder={handleMoveToFolder}
        onOpenFolderManager={() => {
          closeMoveToFolder();
          setIsFolderManagerOpen(true);
        }}
      />}

      <ConfirmationDialog
        isOpen={Boolean(trashConfirmationAsset)}
        title="ย้ายผลงานไปถังขยะ?"
        description={trashConfirmationAsset ? `ย้ายผลงาน “${trashConfirmationAsset.title}” ไปยังถังขยะหรือไม่?` : ''}
        confirmLabel="ย้ายไปถังขยะ"
        onCancel={() => setTrashConfirmationAsset(null)}
        onConfirm={handleConfirmVaultTrash}
      />

      {isAIOpen && <AIAssistantModal
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        initialType={aiContext?.type}
        initialContext={aiContext?.context}
        onApplyResult={(aiText) => {
          // Handled in context
        }}
      />}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <OnboardingModal />

      <SettingsModal />

      {isEditorOpen && <CreatorWorkWorkspace
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        initialData={editingAsset}
        creatorProfile={currentUser}
        folders={folders}
        ownedWorks={assets}
        onSave={handleSaveCreatorWork}
      />}
      </React.Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

