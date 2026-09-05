import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import type { Asset, AssetCategory, AssetStatus } from './types';
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
import { useFolderData } from './hooks/useFolderData';
import { useEngagementData } from './hooks/useEngagementData';
import { useRecentlyViewed } from './hooks/useRecentlyViewed';
import { useAssetFilters } from './hooks/useAssetFilters';
import { useAssetModalState } from './hooks/useAssetModalState';
import { useAssetActions } from './hooks/useAssetActions';
import { getLegacyProfileRedirect, parseCanonicalProfileLocation } from './lib/profileRouting';
import { getCanonicalProfilePath } from './lib/profileIdentity';
import type { CreatorWorkDraft } from './components/creator/CreatorWorkWorkspace';
import { serializeCreatorWorkDraft } from './components/creator/creatorWorkSerializer';

const DiscoverPage = React.lazy(() => import('./pages/DiscoverPage').then(module => ({ default: module.DiscoverPage })));
const CreatorSpacePage = React.lazy(() => import('./pages/CreatorSpacePage').then(module => ({ default: module.CreatorSpacePage })));
const WorkDetailModal = React.lazy(() => import('./components/WorkDetailModal').then(module => ({ default: module.WorkDetailModal })));
const AIAssistantModal = React.lazy(() => import('./components/AIAssistantModal').then(module => ({ default: module.AIAssistantModal })));
const FolderManagerModal = React.lazy(() => import('./components/FolderManagerModal').then(module => ({ default: module.FolderManagerModal })));
const MoveToFolderModal = React.lazy(() => import('./components/MoveToFolderModal').then(module => ({ default: module.MoveToFolderModal })));
const ReportModal = React.lazy(() => import('./components/ReportModal').then(module => ({ default: module.ReportModal })));
const CreatorWorkWorkspace = React.lazy(() => import('./components/creator/CreatorWorkWorkspace').then(module => ({ default: module.CreatorWorkWorkspace })));

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

  // Navigation State
  const [activeView, setActiveView] = useState<'feed' | 'vault'>('feed');
  const [activeVaultTab, setActiveVaultTab] = useState<VaultTabType>('my_assets');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<AssetStatus | 'all'>('all');
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

  const [operationError, setOperationError] = useState<string | null>(null);
  const reportOperationError = useCallback((message: string) => {
    setOperationError(message);
  }, []);
  const resolvedUserId = authLoading ? undefined : currentUser?.id;
  const assetLoadOptions = useMemo(() => {
    if (creatorSlug) {
      let decodedSlug = creatorSlug;
      try { decodedSlug = decodeURIComponent(decodedSlug).trim(); } catch { /* keep the raw route value */ }
      const isOwnerProfile = Boolean(currentUser && (
        decodedSlug === currentUser.id ||
        decodedSlug.toLowerCase() === currentUser.username?.trim().toLowerCase()
      ));
      return { creatorSlug, includeDeleted: true, detail: isOwnerProfile ? 'full' : 'summary', limit: 100 } as const;
    }
    if (workRoute?.[1]) {
      let assetId = workRoute[1];
      try { assetId = decodeURIComponent(assetId); } catch { /* keep the raw route value */ }
      return { assetId, detail: 'full', limit: 1 } as const;
    }
    if (activeView === 'vault' && currentUser?.id) {
      return { userId: currentUser.id, includeDeleted: true, detail: 'full', limit: 100 } as const;
    }
    return { publicOnly: true, detail: 'summary', limit: 48 } as const;
  }, [activeView, creatorSlug, currentUser, workRoute?.[1]]);

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
  } = useAssetData(currentUser, reportOperationError, true, assetLoadOptions);
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
  const { recentlyViewedIds, trackRecentlyViewed } = useRecentlyViewed();

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
  const handleOpenAssetView = useCallback(async (asset: Asset) => {
    await loadAssetDetail(asset.id);
    openAssetView(asset.id);
    trackRecentlyViewed(asset.id);
  }, [loadAssetDetail, openAssetView, trackRecentlyViewed]);

  const handleViewChange = useCallback((view: 'feed' | 'vault') => {
    if (authLoading) return;
    if (view === 'vault' && !currentUser) {
      openAuthModal('login');
      return;
    }
    setActiveView(view);
    setSelectedTag(null);
  }, [authLoading, currentUser, openAuthModal]);

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

  const handleSaveCreatorWork = useCallback(async (draft: CreatorWorkDraft) => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนบันทึกผลงาน' };
    const serialized = serializeCreatorWorkDraft({
      ...draft,
      imagePromptToolModel: draft.contentCanvas.imagePrompt.toolModel
    });

    if (editingAssetId) {
      const result = await updateAsset(editingAssetId, {
        ...serialized
      });
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
    });
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

  const { filteredAssets, categoryCounts, vaultStats, folderAssetCounts } = useAssetFilters({
    assets,
    folders,
    activeView,
    activeVaultTab,
    selectedCategory,
    selectedTag,
    selectedFolderId,
    selectedStatusFilter,
    visibilityFilter,
    searchQuery,
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
    selectedTag,
    selectedFolderId,
    selectedStatusFilter,
    visibilityFilter,
    categoryCounts,
    bookmarkedAssetIds,
    likedAssetIds,
    currentUserId: currentUser?.id,
    currentUser,
    onSelectCategory: (category: AssetCategory) => setSelectedCategory(category),
    onClearTag: () => setSelectedTag(null),
    onVisibilityFilterChange: setVisibilityFilter,
    onSelectStatusFilter: setSelectedStatusFilter,
    onOpenAsset: handleOpenAssetView,
    onEditAsset: handleEditVaultAsset,
    onDeleteAsset: handleDeleteVaultAsset,
    onLike: handleLikeAsset,
    onBookmark: handleToggleBookmark,
    onFork: handleForkAsset,
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
          onLike={handleLikeAsset}
          onBookmark={handleToggleBookmark}
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
            {operationError && (
              <div className="mb-4 p-3 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{operationError}</span>
                <button type="button" onClick={() => setOperationError(null)} aria-label="ปิดข้อความแจ้งเตือน" className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <DiscoverPage collectionProps={collectionProps} />
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
      <React.Suspense fallback={null}>
      {viewingAsset && <WorkDetailModal
        asset={viewingAsset}
        isOpen={!!viewingAsset}
        onClose={closeAssetView}
        onEdit={asset => { closeAssetView(); openEditEditor(asset.id); }}
        onDelete={handleSoftDeleteAsset}
        onPermanentDelete={handlePermanentDeleteAsset}
        onRestore={handleRestoreAsset}
        onLike={handleLikeAsset}
        onBookmark={handleToggleBookmark}
        onFork={handleForkAsset}
        onReport={handleOpenReport}
        onSelectLinkedAsset={(linkedId) => {
          const target = assets.find(a => a.id === linkedId);
          if (target) handleOpenAssetView(target);
        }}
        allAssets={assets}
        folders={foldersWithCounts}
        onMoveToFolder={handleOpenMoveToFolder}
        isOwner={viewingAsset?.userId === currentUser?.id}
        creatorProfile={viewingAsset && viewingAsset.userId === currentUser?.id ? currentUser : null}
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
