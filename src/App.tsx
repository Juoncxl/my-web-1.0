import React, { useCallback, useEffect, useState } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import type { Asset, AssetCategory, AssetStatus } from './types';
import {
  canCreateOwnedAsset
} from './lib/accessPolicy';
import { Header } from './components/Header';
import { AssetViewModal } from './components/AssetViewModal';
import { AssetEditorModal } from './components/AssetEditorModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { SettingsModal } from './components/SettingsModal';
import { ProfileEditModal } from './components/ProfileEditModal';
import { VaultTabType } from './components/PersonalVaultHeader';
import { FolderManagerModal } from './components/FolderManagerModal';
import { MoveToFolderModal } from './components/MoveToFolderModal';
import { ReportModal } from './components/ReportModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AlertCircle, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAssetData } from './hooks/useAssetData';
import { useFolderData } from './hooks/useFolderData';
import { useEngagementData } from './hooks/useEngagementData';
import { useRecentlyViewed } from './hooks/useRecentlyViewed';
import { useAssetFilters } from './hooks/useAssetFilters';
import { useAssetModalState } from './hooks/useAssetModalState';
import { useAssetActions } from './hooks/useAssetActions';
import { DiscoverPage } from './pages/DiscoverPage';
import { VaultPage } from './pages/VaultPage';

function MainApp() {
  const { 
    currentUser, 
    isAuthOpen,
    setIsAuthOpen,
    openAuthModal,
    isOnboardingOpen,
    setIsOnboardingOpen,
    isSettingsOpen,
    setIsSettingsOpen
  } = useAuth();

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
  } = useAssetData(currentUser, reportOperationError);
  const {
    folders,
    refreshFolders,
    createFolder,
    updateFolder,
    deleteFolder
  } = useFolderData(currentUser?.id, reportOperationError);
  const {
    bookmarkedAssetIds,
    likedAssetIds,
    toggleBookmark,
    toggleLike
  } = useEngagementData(currentUser?.id, reportOperationError);
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
    openCreateEditor,
    openEditEditor,
    closeEditor,
    openReport,
    closeReport,
    openMoveToFolder,
    closeMoveToFolder
  } = useAssetModalState(assets);

  // Simple UI-only state stays local to App; asset selections live in the
  // focused asset modal hook above.
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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

  // Track recently viewed items while keeping the selected asset canonical.
  const handleOpenAssetView = useCallback((asset: Asset) => {
    openAssetView(asset.id);
    trackRecentlyViewed(asset.id);
  }, [openAssetView, trackRecentlyViewed]);

  const handleViewChange = useCallback((view: 'feed' | 'vault') => {
    if (view === 'vault' && !currentUser) {
      openAuthModal('login');
      return;
    }
    setActiveView(view);
    setSelectedTag(null);
  }, [currentUser, openAuthModal]);

  // Persisted actions require a real Supabase account session.
  const handleOpenCreateModal = useCallback(() => {
    if (!canCreateOwnedAsset(currentUser)) {
      openAuthModal('signup');
      return;
    }
    openCreateEditor();
  }, [currentUser, openAuthModal, openCreateEditor]);

  const handleOpenAIModal = useCallback(() => {
    setAiContext(null);
    setIsAIOpen(true);
  }, []);

  const handleOpenMoveToFolder = useCallback((asset: Asset) => {
    openMoveToFolder(asset.id);
  }, [openMoveToFolder]);

  const handleForkSuccess = useCallback(() => {
    setActiveView('vault');
    setActiveVaultTab('my_assets');
    confetti({ particleCount: 35, spread: 55, origin: { y: 0.6 } });
  }, []);

  const handleBookmarkSuccess = useCallback(() => {
    confetti({
      particleCount: 20,
      spread: 40,
      origin: { y: 0.8 },
      colors: ['#F59E0B', '#EC4899', '#8B5CF6']
    });
  }, []);

  const {
    handleSaveAsset,
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
    onOpenAsset: handleOpenAssetView,
    onLike: handleLikeAsset,
    onBookmark: handleToggleBookmark,
    onFork: handleForkAsset,
    onReport: handleOpenReport,
    onRestore: handleRestoreAsset,
    onPermanentDelete: handlePermanentDeleteAsset,
    onSelectTag: setSelectedTag,
    onOpenMoveToFolder: handleOpenMoveToFolder,
    onCreateAsset: handleOpenCreateModal
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeView={activeView}
        onViewChange={handleViewChange}
        onOpenCreateModal={handleOpenCreateModal}
        onOpenAIModal={handleOpenAIModal}
        onOpenAuthModal={() => openAuthModal('login')}
        onOpenSignUpModal={() => openAuthModal('signup')}
        onOpenProfileModal={() => setIsProfileOpen(true)}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {operationError && (
          <div className="mb-4 p-3 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{operationError}</span>
            <button type="button" onClick={() => setOperationError(null)} aria-label="ปิดข้อความแจ้งเตือน" className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        
        {activeView === 'feed' ? (
          <DiscoverPage
            collectionProps={collectionProps}
            onOpenAIModal={handleOpenAIModal}
            onCreateAsset={handleOpenCreateModal}
          />
        ) : (
          <VaultPage
            collectionProps={collectionProps}
            totalAssetsCount={vaultStats.total}
            publicCount={vaultStats.publicCount}
            privateCount={vaultStats.privateCount}
            bookmarksCount={vaultStats.bookmarksCount}
            trashCount={vaultStats.trashCount}
            folders={foldersWithCounts}
            selectedFolderId={selectedFolderId}
            activeVaultTab={activeVaultTab}
            selectedStatusFilter={selectedStatusFilter}
            onSelectFolder={setSelectedFolderId}
            onChangeVaultTab={setActiveVaultTab}
            onSelectStatusFilter={setSelectedStatusFilter}
            onOpenFolderManager={() => setIsFolderManagerOpen(true)}
            onEditProfile={() => setIsProfileOpen(true)}
            onCreateAsset={handleOpenCreateModal}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-purple-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>🌸</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">Creator Vault</span>
            <span>— คลังความรู้ & ผลงานสำหรับนักสร้างแชทบอทและนักเขียน</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-purple-700 dark:text-purple-400 font-medium">
              <span>✦ Minimalist Gen Z Creator Studio</span>
            </span>
            <span>•</span>
            <span>Supabase BaaS Realtime Sync</span>
          </div>
        </div>
      </footer>

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

      <AssetEditorModal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        onSave={handleSaveAsset}
        initialData={editingAsset}
        folders={folders}
        availableAssets={assets.filter(a => a.userId === currentUser?.id && !a.deletedAt)}
        onOpenAIModalWithContext={(type, ctx) => {
          setAiContext({ type, context: ctx });
          setIsAIOpen(true);
        }}
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

      <ProfileEditModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
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
