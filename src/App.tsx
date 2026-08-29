import React, { useCallback, useEffect, useState } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Asset, AssetCategory, AssetStatus } from './types';
import { supabaseService } from './lib/supabaseService';
import {
  canCreateOwnedAsset,
  canForkAsset
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
    setAssets,
    isLoadingAssets,
    refreshAssets
  } = useAssetData(currentUser?.id, reportOperationError);
  const { folders, setFolders, refreshFolders } = useFolderData(currentUser?.id, reportOperationError);
  const {
    bookmarkedAssetIds,
    setBookmarkedAssetIds,
    likedAssetIds,
    setLikedAssetIds
  } = useEngagementData(currentUser?.id, reportOperationError);
  const { recentlyViewedIds, trackRecentlyViewed } = useRecentlyViewed();

  // Modals State
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [reportingAsset, setReportingAsset] = useState<Asset | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false);
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const [movingAsset, setMovingAsset] = useState<Asset | null>(null);
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

  // Track recently viewed items
  const handleOpenAssetView = (asset: Asset) => {
    setViewingAsset(asset);
    trackRecentlyViewed(asset.id);
  };

  const handleViewChange = (view: 'feed' | 'vault') => {
    if (view === 'vault' && !currentUser) {
      openAuthModal('login');
      return;
    }
    setActiveView(view);
    setSelectedTag(null);
  };

  // Persisted actions require a real Supabase account session.
  const handleOpenCreateModal = () => {
    if (!canCreateOwnedAsset(currentUser)) {
      openAuthModal('signup');
      return;
    }
    setEditingAsset(null);
    setIsCreateOpen(true);
  };

  // Handle Save (Create or Update)
  const handleSaveAsset = async (assetData: Partial<Asset>): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำการบันทึกผลงาน' };

    try {
      if (editingAsset) {
        // Update existing directly in Supabase
        const res = await supabaseService.updateAsset(editingAsset.id, assetData);
        if (res.error) {
          return { success: false, error: res.error };
        }
        if (res.data) {
          setAssets(prev => prev.map(a => (a.id === editingAsset.id ? res.data! : a)));
          if (viewingAsset?.id === editingAsset.id) {
            setViewingAsset(res.data);
          }
          setEditingAsset(null);
          return { success: true };
        }
      } else {
        // Create new directly in Supabase
        const res = await supabaseService.createAsset({
          userId: currentUser.id,
          authorName: currentUser.displayName,
          authorAvatar: currentUser.avatarUrl,
          title: assetData.title || 'Untitled Asset',
          icon: assetData.icon || { type: 'emoji', value: '✨' },
          category: assetData.category || 'character',
          content: assetData.content || '',
          uiCodeSnippet: assetData.uiCodeSnippet || '',
          previewImages: assetData.previewImages || (assetData.previewImage ? [assetData.previewImage] : []),
          folderId: assetData.folderId || null,
          isPublic: assetData.visibility === 'public' || (assetData.isPublic !== undefined ? assetData.isPublic : true),
          visibility: assetData.visibility || 'public',
          status: assetData.status || 'finished',
          linkedAssetIds: assetData.linkedAssetIds || [],
          tags: assetData.tags || []
        });

        if (res.error) {
          return { success: false, error: res.error };
        }
        if (res.data) {
          setAssets(prev => [res.data!, ...prev]);
          setIsCreateOpen(false);
          return { success: true };
        }
      }
    } catch (err: any) {
      console.error('Save asset error:', err);
      return { success: false, error: err?.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุในการบันทึกผลงาน' };
    }
    return { success: false, error: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง' };
  };

  // Feature 9: Soft Delete / Move to Trash
  const handleSoftDeleteAsset = async (assetId: string) => {
    if (!currentUser) return;
    try {
      const res = await supabaseService.softDeleteAsset(assetId);
      if (res.success) {
        setOperationError(null);
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, deletedAt: new Date().toISOString() } : a));
        setViewingAsset(null);
      } else {
        setOperationError(res.error || 'ย้ายผลงานไปถังขยะไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Soft delete error:', err);
      setOperationError('ย้ายผลงานไปถังขยะไม่สำเร็จ');
    }
  };

  // Feature 9: Restore Asset from Trash
  const handleRestoreAsset = async (assetId: string) => {
    if (!currentUser) return;
    try {
      const res = await supabaseService.restoreAsset(assetId);
      if (res.success) {
        setOperationError(null);
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, deletedAt: null } : a));
      } else {
        setOperationError(res.error || 'กู้คืนผลงานไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Restore error:', err);
      setOperationError('กู้คืนผลงานไม่สำเร็จ');
    }
  };

  // Permanent Delete
  const handlePermanentDeleteAsset = async (assetId: string) => {
    if (!currentUser) return;
    try {
      const res = await supabaseService.permanentDeleteAsset(assetId);
      if (res.success) {
        setOperationError(null);
        setAssets(prev => prev.filter(a => a.id !== assetId));
        setViewingAsset(null);
      } else {
        setOperationError(res.error || 'ลบผลงานถาวรไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Delete asset error:', err);
      setOperationError('ลบผลงานถาวรไม่สำเร็จ');
    }
  };

  // Feature 2: Bookmark Toggle
  const handleToggleBookmark = async (assetId: string) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    const isCurrentlyBookmarked = bookmarkedAssetIds.includes(assetId);
    
    try {
      const result = await supabaseService.setBookmark(
        currentUser.id,
        assetId,
        !isCurrentlyBookmarked
      );
      if (!result.success) {
        setOperationError(result.error || 'อัปเดตบุ๊กมาร์กไม่สำเร็จ');
        return;
      }

      setOperationError(null);
      setBookmarkedAssetIds(prev => result.isBookmarked
        ? Array.from(new Set([...prev, assetId]))
        : prev.filter(id => id !== assetId)
      );
      if (result.isBookmarked && !isCurrentlyBookmarked) {
        confetti({
          particleCount: 20,
          spread: 40,
          origin: { y: 0.8 },
          colors: ['#F59E0B', '#EC4899', '#8B5CF6']
        });
      }
    } catch (err) {
      console.error('Bookmark error:', err);
      setOperationError('อัปเดตบุ๊กมาร์กไม่สำเร็จ');
    }
  };

  // Feature 4: Duplicate / Fork Asset into User's Vault
  const handleForkAsset = async (sourceAsset: Asset) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    if (!canForkAsset(currentUser, sourceAsset)) {
      setOperationError('ผลงานนี้เป็นส่วนตัว ถูกลบ หรือไม่สามารถสร้างสำเนาได้');
      return;
    }

    try {
      const res = await supabaseService.forkAsset(
        sourceAsset,
        currentUser.id,
        currentUser.displayName,
        currentUser.avatarUrl
      );

      if (res.data) {
        setOperationError(null);
        setAssets(prev => {
          const withUpdatedSource = prev.map(asset =>
            asset.id === sourceAsset.id && res.sourceForkCount !== null
              ? { ...asset, forkCount: res.sourceForkCount }
              : asset
          );
          return [res.data!, ...withUpdatedSource];
        });
        if (viewingAsset?.id === sourceAsset.id && res.sourceForkCount !== null) {
          setViewingAsset(prev => prev ? { ...prev, forkCount: res.sourceForkCount! } : null);
        }
        setActiveView('vault');
        setActiveVaultTab('my_assets');
        
        confetti({
          particleCount: 35,
          spread: 55,
          origin: { y: 0.6 }
        });
      } else {
        setOperationError(res.error || 'สร้างสำเนาผลงานไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Fork asset error:', err);
      setOperationError('สร้างสำเนาผลงานไม่สำเร็จ');
    }
  };

  // Handle Move to Folder
  const handleMoveToFolder = async (assetId: string, folderId: string | null): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await supabaseService.updateAsset(assetId, { folderId });
      if (res.data) {
        setOperationError(null);
        setAssets(prev => prev.map(a => (a.id === assetId ? res.data! : a)));
        if (viewingAsset?.id === assetId) {
          setViewingAsset(res.data);
        }
        return true;
      }
      setOperationError(res.error || 'ย้ายผลงานเข้าโฟลเดอร์ไม่สำเร็จ');
    } catch (err) {
      console.error('Move to folder error:', err);
      setOperationError('ย้ายผลงานเข้าโฟลเดอร์ไม่สำเร็จ');
    }
    return false;
  };

  // Folder CRUD
  const handleCreateFolder = async (name: string, icon = '📁', color = 'purple'): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await supabaseService.createFolder({
        userId: currentUser.id,
        name,
        icon,
        color
      });
      if (res.data) {
        setOperationError(null);
        setFolders(prev => [...prev, res.data!]);
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
      const res = await supabaseService.updateFolder(id, currentUser.id, { name, icon, color });
      if (res.data) {
        setOperationError(null);
        setFolders(prev => prev.map(f => (f.id === id ? res.data! : f)));
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
      const res = await supabaseService.deleteFolder(id, currentUser.id);
      if (res.success) {
        setOperationError(null);
        setFolders(prev => prev.filter(f => f.id !== id));
        setAssets(prev => prev.map(a => (a.folderId === id ? { ...a, folderId: null } : a)));
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

  // Handle Like
  const handleLikeAsset = async (assetId: string) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    const wasLiked = likedAssetIds.includes(assetId);
    try {
      const result = await supabaseService.setAssetLike(currentUser.id, assetId, !wasLiked);
      if (!result.success) {
        setOperationError(result.error || 'อัปเดตสถานะถูกใจไม่สำเร็จ');
        return;
      }

      setOperationError(null);
      setLikedAssetIds(prev => result.isLiked
        ? Array.from(new Set([...prev, assetId]))
        : prev.filter(id => id !== assetId)
      );
      if (result.likesCount !== null) {
        setAssets(prev => prev.map(a =>
          a.id === assetId ? { ...a, likesCount: result.likesCount! } : a
        ));
        if (viewingAsset?.id === assetId) {
          setViewingAsset(prev => prev ? { ...prev, likesCount: result.likesCount! } : null);
        }
      }
    } catch (e) {
      console.error('Like error:', e);
      setOperationError('อัปเดตสถานะถูกใจไม่สำเร็จ');
    }
  };

  const handleOpenReport = (asset: Asset) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    setReportingAsset(asset);
  };

  const { filteredAssets, categoryCounts, vaultStats } = useAssetFilters({
    assets,
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

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeView={activeView}
        onViewChange={handleViewChange}
        onOpenCreateModal={handleOpenCreateModal}
        onOpenAIModal={() => {
          setAiContext(null);
          setIsAIOpen(true);
        }}
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
            collectionProps={{
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
              currentUserId: currentUser?.id,
              onSelectCategory: category => setSelectedCategory(category),
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
              onOpenMoveToFolder: asset => {
                setMovingAsset(asset);
                setIsMoveToFolderOpen(true);
              },
              onCreateAsset: handleOpenCreateModal
            }}
            onOpenAIModal={() => {
              setAiContext(null);
              setIsAIOpen(true);
            }}
            onCreateAsset={handleOpenCreateModal}
          />
        ) : (
          <VaultPage
            collectionProps={{
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
              currentUserId: currentUser?.id,
              onSelectCategory: category => setSelectedCategory(category),
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
              onOpenMoveToFolder: asset => {
                setMovingAsset(asset);
                setIsMoveToFolderOpen(true);
              },
              onCreateAsset: handleOpenCreateModal
            }}
            totalAssetsCount={vaultStats.total}
            publicCount={vaultStats.publicCount}
            privateCount={vaultStats.privateCount}
            bookmarksCount={vaultStats.bookmarksCount}
            trashCount={vaultStats.trashCount}
            folders={folders}
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
        onClose={() => setViewingAsset(null)}
        onEdit={(asset) => {
          setEditingAsset(asset);
          setViewingAsset(null);
          setIsCreateOpen(true);
        }}
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
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingAsset(null);
        }}
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
        onClose={() => setReportingAsset(null)}
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
        isOpen={isMoveToFolderOpen}
        onClose={() => {
          setIsMoveToFolderOpen(false);
          setMovingAsset(null);
        }}
        asset={movingAsset}
        folders={folders}
        onMoveToFolder={handleMoveToFolder}
        onOpenFolderManager={() => {
          setIsMoveToFolderOpen(false);
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
