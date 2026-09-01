import React, { useCallback, useEffect, useState } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import type { Asset, AssetCategory, AssetStatus } from './types';
import {
  canCreateOwnedAsset
} from './lib/accessPolicy';
import { Header } from './components/Header';
import { AssetViewModal } from './components/AssetViewModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { SettingsModal } from './components/SettingsModal';
import { VaultTabType } from './components/PersonalVaultHeader';
import { FolderManagerModal } from './components/FolderManagerModal';
import { MoveToFolderModal } from './components/MoveToFolderModal';
import { ReportModal } from './components/ReportModal';
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
import { DiscoverPage } from './pages/DiscoverPage';
import { CreatorSpacePage } from './pages/CreatorSpacePage';
import { getLegacyProfileRedirect, parseCanonicalProfileLocation } from './lib/profileRouting';
import { getCanonicalProfilePath } from './lib/profileIdentity';
import { CreatorWorkWorkspace, type CreatorWorkDraft } from './components/creator/CreatorWorkWorkspace';

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

  const [operationError, setOperationError] = useState<string | null>(null);
  const reportOperationError = useCallback((message: string) => {
    setOperationError(message);
  }, []);
  const resolvedUserId = authLoading ? undefined : currentUser?.id;

  const {
    assets,
    isLoadingAssets,
    refreshAssets,
    createAsset,
    updateAsset,
    softDeleteAsset,
    restoreAsset,
    permanentDeleteAsset,
    forkAsset,
    moveAsset,
    updateAssetLikeCount,
    clearFolderAssignments
  } = useAssetData(currentUser, reportOperationError, !authLoading);
  const {
    folders,
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
    openAssetView(asset.id);
    trackRecentlyViewed(asset.id);
  }, [openAssetView, trackRecentlyViewed]);

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

    if (editingAssetId) {
      const result = await updateAsset(editingAssetId, {
        title: draft.title,
        icon: draft.icon,
        category: draft.category,
        content: draft.content,
        uiCodeSnippet: draft.uiCodeSnippet,
        previewImage: draft.previewImages[0] || '',
        previewImages: draft.previewImages,
        isPublic: draft.visibility === 'public',
        visibility: draft.visibility,
        status: draft.status,
        tags: draft.tags
      });
      if (result.data) {
        window.location.assign(getCanonicalProfilePath(currentUser, '?tab=works'));
        return { success: true };
      }
      return { success: false, error: result.error || 'แก้ไขผลงานไม่สำเร็จ' };
    }

    const result = await createAsset({
      title: draft.title,
      icon: draft.icon,
      category: draft.category,
      content: draft.content,
      uiCodeSnippet: draft.uiCodeSnippet,
      previewImage: draft.previewImages[0],
      previewImages: draft.previewImages,
      folderId: null,
      isPublic: draft.visibility === 'public',
      visibility: draft.visibility,
      status: draft.status,
      tags: draft.tags,
      deletedAt: null,
      likesCount: 0,
      forkCount: 0,
      forkedFromId: null,
      forkedFromAuthor: null,
      linkedAssetIds: [],
      versions: []
    });
    if (result.data) {
      window.location.assign(getCanonicalProfilePath(currentUser, '?tab=works'));
      return { success: true };
    }
    return { success: false, error: result.error || 'สร้างผลงานไม่สำเร็จ' };
  }, [createAsset, currentUser, editingAssetId, updateAsset]);

  const handleOpenAIModal = useCallback(() => {
    setAiContext(null);
    setIsAIOpen(true);
  }, []);

  const handleOpenMoveToFolder = useCallback((asset: Asset) => {
    openMoveToFolder(asset.id);
  }, [openMoveToFolder]);

  const handleEditVaultAsset = useCallback((asset: Asset) => {
    openEditEditor(asset.id);
  }, [openEditEditor]);

  const handleOpenCreatorProfile = useCallback(() => {
    if (!currentUser) return;
    window.location.assign(getCanonicalProfilePath(currentUser));
  }, [currentUser]);

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
    if (currentUser) window.location.assign(getCanonicalProfilePath(currentUser, '?tab=works'));
    confetti({ particleCount: 35, spread: 55, origin: { y: 0.6 } });
  }, [currentUser]);

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
    if (window.confirm(`ย้ายผลงาน "${asset.title}" ไปถังขยะใช่หรือไม่?`)) {
      void handleSoftDeleteAsset(asset.id);
    }
  }, [handleSoftDeleteAsset]);

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

  // Do not let account-only UI interpret the initial auth check as a guest
  // session. The AuthProvider is the single source of truth, but its initial
  // getSession/getUser round trip is asynchronous.
  if (authLoading) {
    return (
      <div className="cv-app-shell min-h-screen flex items-center justify-center px-4 text-slate-600 dark:text-slate-300" aria-busy="true">
        <span className="text-sm">กำลังตรวจสอบบัญชี...</span>
      </div>
    );
  }

  return (
    <div className="cv-app-shell min-h-screen flex flex-col text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {creatorSlug ? (
        <CreatorSpacePage
          slug={creatorSlug}
          onCreateAsset={handleOpenCreateModal}
          onEditAsset={handleEditVaultAsset}
          onOpenAuth={() => openAuthModal('login')}
          onOpenFolderManager={() => setIsFolderManagerOpen(true)}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
          allKnownAssets={assets}
          bookmarkedAssetIds={bookmarkedAssetIds}
          recentlyViewedIds={recentlyViewedIds}
          onDeleteAsset={handleDeleteVaultAsset}
          onRestoreAsset={handleRestoreAsset}
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

      {/* Modals */}
      <AssetViewModal
        asset={viewingAsset}
        isOpen={!!viewingAsset}
        onClose={closeAssetView}
        onEdit={asset => openEditEditor(asset.id)}
        onDelete={handleSoftDeleteAsset}
        onPermanentDelete={handlePermanentDeleteAsset}
        onRestore={handleRestoreAsset}
        onBookmark={handleToggleBookmark}
        onFork={handleForkAsset}
        onReport={handleOpenReport}
        onSelectLinkedAsset={(linkedId) => {
          const target = assets.find(a => a.id === linkedId);
          if (target) handleOpenAssetView(target);
        }}
        allAssets={assets}
        isOwner={viewingAsset?.userId === currentUser?.id}
        isBookmarked={viewingAsset ? bookmarkedAssetIds.includes(viewingAsset.id) : false}
        isTrashMode={activeVaultTab === 'trash'}
      />

      <ReportModal
        isOpen={!!reportingAsset}
        onClose={closeReport}
        asset={reportingAsset}
      />

      <FolderManagerModal
        isOpen={isFolderManagerOpen}
        onClose={() => setIsFolderManagerOpen(false)}
        folders={folders}
        onCreateFolder={handleCreateFolder}
        onUpdateFolder={handleUpdateFolder}
        onDeleteFolder={handleDeleteFolder}
      />

      <MoveToFolderModal
        isOpen={!!movingAsset}
        onClose={closeMoveToFolder}
        asset={movingAsset}
        folders={folders}
        onMoveToFolder={handleMoveToFolder}
        onOpenFolderManager={() => {
          closeMoveToFolder();
          setIsFolderManagerOpen(true);
        }}
      />

      <AIAssistantModal
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        initialType={aiContext?.type}
        initialContext={aiContext?.context}
        onApplyResult={(aiText) => {
          // Handled in context
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <OnboardingModal />

      <SettingsModal />

      <CreatorWorkWorkspace
        isOpen={isEditorOpen}
        onClose={closeEditor}
        initialData={editingAsset}
        onSave={handleSaveCreatorWork}
      />
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
