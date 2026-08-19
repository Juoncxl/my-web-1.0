import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Asset, AssetCategory, AssetStatus, Folder } from './types';
import { supabaseService } from './lib/supabaseService';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { AssetCard } from './components/AssetCard';
import { AssetViewModal } from './components/AssetViewModal';
import { AssetEditorModal } from './components/AssetEditorModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { SettingsModal } from './components/SettingsModal';
import { ProfileEditModal } from './components/ProfileEditModal';
import { PersonalVaultHeader, VaultTabType } from './components/PersonalVaultHeader';
import { FolderManagerModal } from './components/FolderManagerModal';
import { MoveToFolderModal } from './components/MoveToFolderModal';
import { GuestLimitModal } from './components/GuestLimitModal';
import { ReportModal } from './components/ReportModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  Sparkles, 
  Globe, 
  Lock, 
  Plus, 
  Search, 
  Compass, 
  FolderLock, 
  RefreshCw,
  Heart,
  ShieldCheck,
  Folder as FolderIcon,
  Bookmark as BookmarkIcon,
  Clock,
  Trash2,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';

const RECENTLY_VIEWED_STORAGE_KEY = 'creator_vault_recently_viewed';

function MainApp() {
  const { 
    currentUser, 
    isLoading: authLoading,
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

  // Assets, Folders & Bookmarks Data State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [bookmarkedAssetIds, setBookmarkedAssetIds] = useState<string[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);

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
  const [isGuestLimitOpen, setIsGuestLimitOpen] = useState(false);
  const [aiContext, setAiContext] = useState<{ type: string; context: string } | null>(null);

  // Fetch Assets via direct Supabase BaaS
  const fetchAssets = async () => {
    try {
      setIsLoadingAssets(true);
      const res = await supabaseService.fetchAssets({
        currentUserId: currentUser?.id,
        includeDeleted: true // we filter deleted items in specific tabs
      });
      if (res.data) {
        setAssets(res.data);
      }
    } catch (e) {
      console.error('Error loading assets:', e);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  // Fetch Folders via direct Supabase BaaS
  const fetchFolders = async () => {
    if (!currentUser?.id) {
      setFolders([]);
      return;
    }
    try {
      const res = await supabaseService.fetchFolders(currentUser.id);
      if (res.data) {
        setFolders(res.data);
      }
    } catch (e) {
      console.error('Error loading folders:', e);
    }
  };

  // Fetch Bookmarks
  const fetchBookmarks = async () => {
    if (!currentUser?.id) {
      setBookmarkedAssetIds([]);
      return;
    }
    try {
      const ids = await supabaseService.fetchBookmarks(currentUser.id);
      setBookmarkedAssetIds(ids);
    } catch (e) {
      console.error('Error loading bookmarks:', e);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchFolders();
    fetchBookmarks();
  }, [currentUser?.id]);

  // Track recently viewed items
  const handleOpenAssetView = (asset: Asset) => {
    setViewingAsset(asset);
    setRecentlyViewedIds(prev => {
      const filtered = prev.filter(id => id !== asset.id);
      const updated = [asset.id, ...filtered].slice(0, 30);
      try {
        localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  // Current Guest Asset Count
  const guestAssetCount = useMemo(() => {
    if (!currentUser?.isAnonymous) return 0;
    return assets.filter(a => a.userId === currentUser.id && !a.deletedAt).length;
  }, [assets, currentUser]);

  // Check if user can create asset or should see Guest Limit modal
  const handleOpenCreateModal = () => {
    if (currentUser?.isAnonymous && guestAssetCount >= 2) {
      setIsGuestLimitOpen(true);
      return;
    }
    setEditingAsset(null);
    setIsCreateOpen(true);
  };

  // Handle Save (Create or Update)
  const handleSaveAsset = async (assetData: Partial<Asset>): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำการบันทึกผลงาน' };

    // Check guest limit before saving if creating new
    if (!editingAsset && currentUser.isAnonymous && guestAssetCount >= 2) {
      setIsGuestLimitOpen(true);
      return { 
        success: false, 
        error: 'บัญชีผู้เยี่ยมชม (Guest) สามารถสร้างผลงานได้สูงสุด 2 รายการ กรุณาสมัครหรือเข้าสู่ระบบเพื่อสร้างผลงานได้ไม่จำกัด' 
      };
    }

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
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, deletedAt: new Date().toISOString() } : a));
        setViewingAsset(null);
      }
    } catch (err) {
      console.error('Soft delete error:', err);
    }
  };

  // Feature 9: Restore Asset from Trash
  const handleRestoreAsset = async (assetId: string) => {
    if (!currentUser) return;
    try {
      const res = await supabaseService.restoreAsset(assetId);
      if (res.success) {
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, deletedAt: null } : a));
      }
    } catch (err) {
      console.error('Restore error:', err);
    }
  };

  // Permanent Delete
  const handlePermanentDeleteAsset = async (assetId: string) => {
    if (!currentUser) return;
    try {
      const res = await supabaseService.permanentDeleteAsset(assetId);
      if (res.success) {
        setAssets(prev => prev.filter(a => a.id !== assetId));
        setViewingAsset(null);
      }
    } catch (err) {
      console.error('Delete asset error:', err);
    }
  };

  // Feature 2: Bookmark Toggle
  const handleToggleBookmark = async (assetId: string) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    const isCurrentlyBookmarked = bookmarkedAssetIds.includes(assetId);
    
    // Optimistic UI update
    setBookmarkedAssetIds(prev => 
      isCurrentlyBookmarked ? prev.filter(id => id !== assetId) : [...prev, assetId]
    );

    if (!isCurrentlyBookmarked) {
      confetti({
        particleCount: 20,
        spread: 40,
        origin: { y: 0.8 },
        colors: ['#F59E0B', '#EC4899', '#8B5CF6']
      });
    }

    try {
      await supabaseService.toggleBookmark(currentUser.id, assetId);
    } catch (err) {
      console.error('Bookmark error:', err);
      // Revert on error
      setBookmarkedAssetIds(prev => 
        isCurrentlyBookmarked ? [...prev, assetId] : prev.filter(id => id !== assetId)
      );
    }
  };

  // Feature 4: Duplicate / Fork Asset into User's Vault
  const handleForkAsset = async (sourceAsset: Asset) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }

    // Check guest limit
    if (currentUser.isAnonymous && guestAssetCount >= 2) {
      setIsGuestLimitOpen(true);
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
        setAssets(prev => [res.data!, ...prev]);
        setActiveView('vault');
        setActiveVaultTab('my_assets');
        
        confetti({
          particleCount: 35,
          spread: 55,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      console.error('Fork asset error:', err);
    }
  };

  // Handle Move to Folder
  const handleMoveToFolder = async (assetId: string, folderId: string | null): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await supabaseService.updateAsset(assetId, { folderId });
      if (res.data) {
        setAssets(prev => prev.map(a => (a.id === assetId ? res.data! : a)));
        if (viewingAsset?.id === assetId) {
          setViewingAsset(res.data);
        }
        return true;
      }
    } catch (err) {
      console.error('Move to folder error:', err);
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
        setFolders(prev => [...prev, res.data!]);
        return true;
      }
    } catch (e) {
      console.error('Create folder error:', e);
    }
    return false;
  };

  const handleUpdateFolder = async (id: string, name: string, icon?: string, color?: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await supabaseService.updateFolder(id, currentUser.id, { name, icon, color });
      if (res.data) {
        setFolders(prev => prev.map(f => (f.id === id ? res.data! : f)));
        return true;
      }
    } catch (e) {
      console.error('Update folder error:', e);
    }
    return false;
  };

  const handleDeleteFolder = async (id: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await supabaseService.deleteFolder(id, currentUser.id);
      if (res.success) {
        setFolders(prev => prev.filter(f => f.id !== id));
        setAssets(prev => prev.map(a => (a.folderId === id ? { ...a, folderId: null } : a)));
        if (selectedFolderId === id) {
          setSelectedFolderId('all');
        }
        return true;
      }
    } catch (e) {
      console.error('Delete folder error:', e);
    }
    return false;
  };

  // Handle Like
  const handleLikeAsset = async (assetId: string) => {
    try {
      const currentAsset = assets.find(a => a.id === assetId);
      const newCount = await supabaseService.likeAsset(assetId, currentAsset?.likesCount || 0);
      setAssets(prev => prev.map(a => (a.id === assetId ? { ...a, likesCount: newCount } : a)));
      if (viewingAsset?.id === assetId) {
        setViewingAsset(prev => prev ? { ...prev, likesCount: newCount } : null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered Assets Computation
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // 1. View & Vault Tab Filter:
      if (activeView === 'feed') {
        // Feed only shows non-deleted public assets
        if (asset.deletedAt) return false;
        if (!asset.isPublic && asset.visibility !== 'public') return false;
      } else if (activeView === 'vault') {
        
        if (activeVaultTab === 'my_assets') {
          if (asset.userId !== currentUser?.id) return false;
          if (asset.deletedAt) return false;

          // Folder filter
          if (selectedFolderId === 'unassigned') {
            if (asset.folderId) return false;
          } else if (selectedFolderId !== 'all') {
            if (asset.folderId !== selectedFolderId) return false;
          }

          // Status filter
          if (selectedStatusFilter !== 'all' && asset.status !== selectedStatusFilter) {
            return false;
          }

          // Visibility sub-filter
          if (visibilityFilter === 'public' && (asset.visibility !== 'public' && !asset.isPublic)) return false;
          if (visibilityFilter === 'private' && (asset.visibility === 'public' || asset.isPublic)) return false;

        } else if (activeVaultTab === 'bookmarks') {
          // Bookmarks tab shows assets in user's bookmark list
          if (asset.deletedAt) return false;
          if (!bookmarkedAssetIds.includes(asset.id)) return false;

        } else if (activeVaultTab === 'recent') {
          // Recently viewed
          if (asset.deletedAt) return false;
          if (!recentlyViewedIds.includes(asset.id)) return false;

        } else if (activeVaultTab === 'trash') {
          // Trash tab: ONLY deleted assets owned by user
          if (asset.userId !== currentUser?.id) return false;
          if (!asset.deletedAt) return false;
        }
      }

      // 2. Category Filter:
      if (selectedCategory !== 'all' && asset.category !== selectedCategory) {
        return false;
      }

      // 3. Tag Filter:
      if (selectedTag) {
        const matchesTag = asset.tags?.some(t => t.toLowerCase() === selectedTag.toLowerCase());
        if (!matchesTag) return false;
      }

      // 4. Search Query Filter:
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = asset.title.toLowerCase().includes(q);
        const matchesContent = asset.content.toLowerCase().includes(q);
        const matchesAuthor = asset.authorName.toLowerCase().includes(q);
        const matchesTags = asset.tags?.some(t => t.toLowerCase().includes(q));
        const matchesCode = asset.uiCodeSnippet?.toLowerCase().includes(q);
        return matchesTitle || matchesContent || matchesAuthor || matchesTags || matchesCode;
      }

      return true;
    });
  }, [
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
    currentUser?.id
  ]);

  // Compute Category Counts for current view
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    
    const baseAssets = assets.filter(asset => {
      if (activeView === 'feed') return !asset.deletedAt && (asset.isPublic || asset.visibility === 'public');
      if (activeView === 'vault') {
        if (activeVaultTab === 'my_assets') return asset.userId === currentUser?.id && !asset.deletedAt;
        if (activeVaultTab === 'bookmarks') return bookmarkedAssetIds.includes(asset.id) && !asset.deletedAt;
        if (activeVaultTab === 'recent') return recentlyViewedIds.includes(asset.id) && !asset.deletedAt;
        if (activeVaultTab === 'trash') return asset.userId === currentUser?.id && !!asset.deletedAt;
      }
      return true;
    });

    counts['all'] = baseAssets.length;
    baseAssets.forEach(a => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });

    return counts;
  }, [assets, activeView, activeVaultTab, bookmarkedAssetIds, recentlyViewedIds, currentUser?.id]);

  // Vault Stats for Header
  const vaultStats = useMemo(() => {
    const userAssets = assets.filter(a => a.userId === currentUser?.id && !a.deletedAt);
    const publicCount = userAssets.filter(a => a.visibility === 'public' || a.isPublic).length;
    const privateCount = userAssets.filter(a => a.visibility === 'private' || !a.isPublic).length;
    const trashCount = assets.filter(a => a.userId === currentUser?.id && !!a.deletedAt).length;
    const bookmarksCount = bookmarkedAssetIds.length;

    return {
      total: userAssets.length,
      publicCount,
      privateCount,
      trashCount,
      bookmarksCount
    };
  }, [assets, bookmarkedAssetIds, currentUser?.id]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeView={activeView}
        onViewChange={(view) => {
          setActiveView(view);
          setSelectedTag(null);
        }}
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
        
        {/* If in Vault view, render Personal Dashboard Banner */}
        {activeView === 'vault' && (
          <PersonalVaultHeader
            totalAssetsCount={vaultStats.total}
            publicCount={vaultStats.publicCount}
            privateCount={vaultStats.privateCount}
            bookmarksCount={vaultStats.bookmarksCount}
            trashCount={vaultStats.trashCount}
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            activeVaultTab={activeVaultTab}
            onChangeVaultTab={setActiveVaultTab}
            selectedStatusFilter={selectedStatusFilter}
            onSelectStatusFilter={setSelectedStatusFilter}
            onOpenFolderManager={() => setIsFolderManagerOpen(true)}
            onEditProfile={() => setIsProfileOpen(true)}
            onCreateAsset={handleOpenCreateModal}
          />
        )}

        {/* If in Feed view, render welcoming banner */}
        {activeView === 'feed' && (
          <div className="mb-6 p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 dark:from-purple-900 dark:via-indigo-900 dark:to-pink-900 text-white shadow-md shadow-purple-200 dark:shadow-purple-950/40 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left z-10">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-xl">🌸</span>
                <h1 className="text-lg sm:text-xl font-black tracking-tight">
                  ฟีดสาธารณะ (Creator Hub & Knowledge Base)
                </h1>
              </div>
              <p className="text-xs text-purple-100 dark:text-purple-200 max-w-xl font-normal leading-relaxed">
                รวมไอเดียโปรไฟล์ตัวละครแชทบอท, บทพูด First Message, Master System Prompts, และโค้ด UI พาสเทล จากนักสร้างทั่วไทย
              </p>
            </div>

            <div className="flex items-center gap-2 z-10 shrink-0">
              <button
                onClick={() => setIsAIOpen(true)}
                className="px-3.5 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>AI ช่วยแต่งบท</span>
              </button>

              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-white text-purple-700 hover:bg-purple-50 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>แชร์ผลงาน</span>
              </button>
            </div>

            {/* Subtle glow background */}
            <div className="absolute right-0 top-0 w-64 h-64 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />
          </div>
        )}

        {/* Category Filter Navigation */}
        <CategoryNav
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          selectedTag={selectedTag}
          onClearTag={() => setSelectedTag(null)}
          categoryCounts={categoryCounts}
          activeView={activeView}
          visibilityFilter={visibilityFilter}
          onVisibilityFilterChange={setVisibilityFilter}
        />

        {/* Assets Masonry / Grid Display */}
        {isLoadingAssets ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">กำลังโหลดข้อมูลคลังผลงาน...</p>
          </div>
        ) : filteredAssets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
            {filteredAssets.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                folderName={folders.find(f => f.id === asset.folderId)?.name}
                folderIcon={folders.find(f => f.id === asset.folderId)?.icon}
                onClick={handleOpenAssetView}
                onLike={handleLikeAsset}
                onBookmark={handleToggleBookmark}
                onFork={handleForkAsset}
                onReport={setReportingAsset}
                onRestore={handleRestoreAsset}
                onPermanentDelete={handlePermanentDeleteAsset}
                onSelectCategory={setSelectedCategory}
                onSelectTag={setSelectedTag}
                onOpenMoveToFolder={(ast) => {
                  setMovingAsset(ast);
                  setIsMoveToFolderOpen(true);
                }}
                isOwner={asset.userId === currentUser?.id}
                isBookmarked={bookmarkedAssetIds.includes(asset.id)}
                isTrashMode={activeVaultTab === 'trash'}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-16 px-4 bg-white/70 dark:bg-slate-900/70 rounded-3xl border border-purple-100 dark:border-slate-800 text-center max-w-md mx-auto my-8 space-y-3">
            <div className="w-14 h-14 bg-purple-50 dark:bg-slate-800 rounded-2xl text-2xl flex items-center justify-center mx-auto shadow-xs">
              {activeView === 'vault' 
                ? (activeVaultTab === 'trash' ? '🗑️' : activeVaultTab === 'bookmarks' ? '⭐' : activeVaultTab === 'recent' ? '🕒' : '🔒')
                : '🔍'}
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
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-sm shadow-purple-200 dark:shadow-purple-950 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>สร้างผลงานใหม่</span>
                </button>
              </div>
            )}
          </div>
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
        onReport={setReportingAsset}
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
        currentGuestAssetCount={guestAssetCount}
        onOpenGuestLimitModal={() => setIsGuestLimitOpen(true)}
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

      <GuestLimitModal
        isOpen={isGuestLimitOpen}
        onClose={() => setIsGuestLimitOpen(false)}
        onOpenAuth={() => {
          setIsGuestLimitOpen(false);
          setIsAuthOpen(true);
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
