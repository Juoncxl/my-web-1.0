import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Asset, AssetCategory, Folder } from './types';
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
import { PersonalVaultHeader } from './components/PersonalVaultHeader';
import { FolderManagerModal } from './components/FolderManagerModal';
import { MoveToFolderModal } from './components/MoveToFolderModal';
import { GuestLimitModal } from './components/GuestLimitModal';
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
  Folder as FolderIcon
} from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all' | 'unassigned'>('all');

  // Assets & Folders Data State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);

  // Modals State
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
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
        currentUserId: currentUser?.id
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

  useEffect(() => {
    fetchAssets();
    fetchFolders();
  }, [currentUser?.id]);

  // Current Guest Asset Count
  const guestAssetCount = useMemo(() => {
    if (!currentUser?.isAnonymous) return 0;
    return assets.filter(a => a.userId === currentUser.id).length;
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

  // Handle Save (Create or Update) via direct Supabase BaaS
  const handleSaveAsset = async (assetData: Partial<Asset>): Promise<boolean> => {
    if (!currentUser) return false;

    // Check guest limit before saving if creating new
    if (!editingAsset && currentUser.isAnonymous && guestAssetCount >= 2) {
      setIsGuestLimitOpen(true);
      return false;
    }

    try {
      if (editingAsset) {
        // Update existing directly in Supabase
        const res = await supabaseService.updateAsset(editingAsset.id, assetData);
        if (res.data) {
          setAssets(prev => prev.map(a => (a.id === editingAsset.id ? res.data! : a)));
          if (viewingAsset?.id === editingAsset.id) {
            setViewingAsset(res.data);
          }
          setEditingAsset(null);
          return true;
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
          isPublic: assetData.isPublic !== undefined ? assetData.isPublic : true,
          tags: assetData.tags || []
        });

        if (res.data) {
          setAssets(prev => [res.data!, ...prev]);
          setIsCreateOpen(false);
          return true;
        }
      }
    } catch (err) {
      console.error('Save asset error:', err);
    }
    return false;
  };

  // Handle Delete Asset via direct Supabase BaaS
  const handleDeleteAsset = async (assetId: string) => {
    if (!currentUser) return;
    try {
      const res = await supabaseService.deleteAsset(assetId);
      if (res.success) {
        setAssets(prev => prev.filter(a => a.id !== assetId));
        setViewingAsset(null);
      }
    } catch (err) {
      console.error('Delete asset error:', err);
    }
  };

  // Handle Move to Folder via direct Supabase BaaS
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

  // Folder CRUD via direct Supabase BaaS
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
        // Reset assets that belonged to deleted folder
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

  // Handle Like via direct Supabase BaaS
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
      // 1. View Filter:
      // 'feed' = ONLY Public assets from everyone
      // 'vault' = ALL assets owned by current user (Public + Private)
      if (activeView === 'feed') {
        if (!asset.isPublic) return false;
      } else if (activeView === 'vault') {
        if (asset.userId !== currentUser?.id) return false;

        // Folder filter in vault
        if (selectedFolderId === 'unassigned') {
          if (asset.folderId) return false;
        } else if (selectedFolderId !== 'all') {
          if (asset.folderId !== selectedFolderId) return false;
        }

        // Visibility sub-filter in vault
        if (visibilityFilter === 'public' && !asset.isPublic) return false;
        if (visibilityFilter === 'private' && asset.isPublic) return false;
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
  }, [assets, activeView, selectedCategory, selectedTag, selectedFolderId, visibilityFilter, searchQuery, currentUser?.id]);

  // Compute Category Counts for current view
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    
    const baseAssets = assets.filter(asset => {
      if (activeView === 'feed') return asset.isPublic;
      if (activeView === 'vault') return asset.userId === currentUser?.id;
      return true;
    });

    counts['all'] = baseAssets.length;
    baseAssets.forEach(a => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });

    return counts;
  }, [assets, activeView, currentUser?.id]);

  // Vault Stats for Header
  const vaultStats = useMemo(() => {
    const userAssets = assets.filter(a => a.userId === currentUser?.id);
    const publicCount = userAssets.filter(a => a.isPublic).length;
    const privateCount = userAssets.filter(a => !a.isPublic).length;
    return {
      total: userAssets.length,
      publicCount,
      privateCount
    };
  }, [assets, currentUser?.id]);

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
        
        {/* If in Vault view, render Personal Dashboard Banner with Folders */}
        {activeView === 'vault' && (
          <PersonalVaultHeader
            totalAssetsCount={vaultStats.total}
            publicCount={vaultStats.publicCount}
            privateCount={vaultStats.privateCount}
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            onOpenFolderManager={() => setIsFolderManagerOpen(true)}
            onEditProfile={() => setIsProfileOpen(true)}
            onCreateAsset={handleOpenCreateModal}
          />
        )}

        {/* If in Feed view, render welcoming banner */}
        {activeView === 'feed' && (
          <div className="mb-6 p-6 rounded-3xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 dark:from-purple-900 dark:via-indigo-900 dark:to-pink-900 text-white shadow-md shadow-purple-200 dark:shadow-purple-950/40 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left z-10">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-xl">🌸</span>
                <h1 className="text-lg sm:text-xl font-black tracking-tight">
                  ฟีดสาธารณะ (Creator Hub & Knowledge Base)
                </h1>
              </div>
              <p className="text-xs text-purple-100 dark:text-purple-200 max-w-xl font-normal">
                รวมไอเดียโปรไฟล์ตัวละครแชทบอท, บทพูด First Message, Master System Prompts, และโค้ด UI พาสเทล จากนักสร้างทั่วไทย
              </p>
            </div>

            <div className="flex items-center gap-2 z-10 shrink-0">
              <button
                onClick={() => setIsAIOpen(true)}
                className="px-3.5 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5 active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>AI ช่วยแต่งบท</span>
              </button>

              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-white text-purple-700 hover:bg-purple-50 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>แชร์ผลงาน</span>
              </button>
            </div>

            {/* Subtle glow background */}
            <div className="absolute right-0 top-0 w-64 h-64 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />
          </div>
        )}

        {/* Category Filter Pills Navigation */}
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
                onClick={setViewingAsset}
                onLike={handleLikeAsset}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                }}
                onSelectTag={(tag) => {
                  setSelectedTag(tag);
                }}
                onOpenMoveToFolder={(ast) => {
                  setMovingAsset(ast);
                  setIsMoveToFolderOpen(true);
                }}
                isOwner={asset.userId === currentUser?.id}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-16 px-4 bg-white/70 dark:bg-slate-900/70 rounded-3xl border border-purple-100 dark:border-purple-900/50 text-center max-w-md mx-auto my-8 space-y-3">
            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-950/60 rounded-2xl text-2xl flex items-center justify-center mx-auto shadow-xs">
              {activeView === 'vault' ? '🔒' : '🔍'}
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {searchQuery
                ? `ไม่พบผลงานที่ตรงกับ "${searchQuery}"`
                : selectedTag
                ? `ไม่พบผลงานที่มีแท็ก #${selectedTag}`
                : activeView === 'vault'
                ? 'ยังไม่มีผลงานในคลังส่วนตัวหรือโฟลเดอร์นี้'
                : 'ยังไม่มีผลงานในหมวดหมู่นี้'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {activeView === 'vault'
                ? 'เริ่มต้นสร้างโปรไฟล์บอท, บันทึก System Prompt หรือโค้ด UI ชิ้นแรกของคุณได้ทันที'
                : 'เป็นคนแรกที่สร้างสรรค์และแชร์ความรู้ลงในหมวดหมู่นี้!'}
            </p>
            <div className="pt-2">
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-sm shadow-purple-200 dark:shadow-purple-950 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>สร้างผลงานใหม่</span>
              </button>
            </div>
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
              <span>🌸 สำหรับนักสร้างแชทบอท & นักเขียน</span>
            </span>
            <span>•</span>
            <span>Google AI Studio & Supabase BaaS</span>
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
        onDelete={handleDeleteAsset}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
        }}
        onSelectTag={(tag) => {
          setSelectedTag(tag);
        }}
        onOpenMoveToFolder={(ast) => {
          setMovingAsset(ast);
          setIsMoveToFolderOpen(true);
        }}
        isOwner={viewingAsset?.userId === currentUser?.id}
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
        currentGuestAssetCount={guestAssetCount}
        onOpenGuestLimitModal={() => setIsGuestLimitOpen(true)}
        onOpenAIModalWithContext={(type, ctx) => {
          setAiContext({ type, context: ctx });
          setIsAIOpen(true);
        }}
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
          // If needed
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
