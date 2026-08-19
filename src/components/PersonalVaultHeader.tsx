import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Folder, AssetStatus } from '../types';
import { FOLDER_COLOR_PRESETS, STATUS_PRESETS } from '../lib/constants';
import { 
  User, 
  Edit3, 
  Lock, 
  Globe, 
  Sparkles, 
  Shield, 
  Plus, 
  Calendar, 
  Folder as FolderIcon, 
  FolderPlus, 
  Settings2,
  Bookmark as BookmarkIcon,
  Trash2,
  Clock,
  Layers,
  Activity
} from 'lucide-react';
import { formatShortDate } from '../lib/dateUtils';

export type VaultTabType = 'my_assets' | 'bookmarks' | 'recent' | 'trash';

interface PersonalVaultHeaderProps {
  totalAssetsCount: number;
  publicCount: number;
  privateCount: number;
  bookmarksCount?: number;
  trashCount?: number;
  folders: Folder[];
  selectedFolderId: string | null | 'all' | 'unassigned';
  onSelectFolder: (folderId: string | null | 'all' | 'unassigned') => void;
  activeVaultTab: VaultTabType;
  onChangeVaultTab: (tab: VaultTabType) => void;
  selectedStatusFilter: AssetStatus | 'all';
  onSelectStatusFilter: (status: AssetStatus | 'all') => void;
  onOpenFolderManager: () => void;
  onEditProfile: () => void;
  onCreateAsset: () => void;
}

export const PersonalVaultHeader: React.FC<PersonalVaultHeaderProps> = ({
  totalAssetsCount,
  publicCount,
  privateCount,
  bookmarksCount = 0,
  trashCount = 0,
  folders,
  selectedFolderId,
  onSelectFolder,
  activeVaultTab,
  onChangeVaultTab,
  selectedStatusFilter,
  onSelectStatusFilter,
  onOpenFolderManager,
  onEditProfile,
  onCreateAsset
}) => {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-4 mb-6">
      
      {/* Profile Header Hero */}
      <div className="bg-gradient-to-r from-purple-100/70 via-pink-50/80 to-purple-50/70 dark:from-purple-950/40 dark:via-slate-900/60 dark:to-indigo-950/40 rounded-3xl p-6 sm:p-8 border border-purple-200/80 dark:border-purple-900/60 shadow-sm relative overflow-hidden transition-colors">
        
        {/* Decorative cute background elements */}
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-pink-300/20 dark:bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-32 -bottom-10 w-44 h-44 bg-purple-300/20 dark:bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          
          {/* Large Profile Avatar */}
          <div className="relative shrink-0">
            <img
              src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt="Avatar"
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-white dark:ring-slate-800 shadow-md"
            />
            <div className="absolute bottom-0 right-0 bg-purple-600 text-white p-1.5 rounded-full ring-2 ring-white dark:ring-slate-800 shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* User Info & Stats */}
          <div className="flex-1 text-center md:text-left space-y-3">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
                    {currentUser?.displayName || 'Creator'}
                  </h1>
                  {currentUser?.isGuest ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                      โหมด Guest (จำกัด 2 ชิ้น)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      ✦ Certified Creator
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  {currentUser?.email ? currentUser.email : 'Local Guest Account'} • เข้าร่วมเมื่อ {currentUser?.createdAt ? formatShortDate(currentUser.createdAt) : 'เมื่อเร็วๆ นี้'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center md:justify-end gap-2">
                <button
                  onClick={onEditProfile}
                  className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs border border-purple-200 dark:border-purple-800 shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>แก้ไขโปรไฟล์</span>
                </button>

                <button
                  onClick={onCreateAsset}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold rounded-xl text-xs shadow-sm shadow-purple-200 dark:shadow-purple-950 transition-transform active:scale-95 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>สร้างผลงานใหม่</span>
                </button>
              </div>
            </div>

            {/* Bio */}
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {currentUser?.bio || 'ยินดีต้อนรับสู่พื้นที่สร้างสรรค์ผลงานของคุณ! บันทึกและจัดระเบียบโฟลเดอร์สำหรับบอท, Prompt, และโค้ด UI'}
            </p>

            {/* Profile Stats Cards */}
            <div className="flex items-center justify-center md:justify-start gap-3 pt-1 flex-wrap">
              
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs px-3.5 py-1.5 rounded-2xl border border-purple-100/90 dark:border-purple-900/60 text-center min-w-[80px]">
                <div className="text-base font-extrabold text-slate-800 dark:text-white">{totalAssetsCount}</div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">ผลงานในคลัง</div>
              </div>

              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs px-3.5 py-1.5 rounded-2xl border border-purple-100/90 dark:border-purple-900/60 text-center min-w-[80px]">
                <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1">
                  <Globe className="w-3 h-3" />
                  <span>{publicCount}</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">สาธารณะ</div>
              </div>

              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs px-3.5 py-1.5 rounded-2xl border border-purple-100/90 dark:border-purple-900/60 text-center min-w-[80px]">
                <div className="text-base font-extrabold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>{privateCount}</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">ส่วนตัว</div>
              </div>

              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs px-3.5 py-1.5 rounded-2xl border border-purple-100/90 dark:border-purple-900/60 text-center min-w-[80px]">
                <div className="text-base font-extrabold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                  <BookmarkIcon className="w-3 h-3" />
                  <span>{bookmarksCount}</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">บุ๊กมาร์ก</div>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Primary Vault Navigation Tabs (My Assets / Bookmarks / Recent / Trash) */}
      <div className="flex items-center justify-between gap-2 border-b border-purple-100 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          
          <button
            onClick={() => onChangeVaultTab('my_assets')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeVaultTab === 'my_assets'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>คลังผลงานของฉัน ({totalAssetsCount})</span>
          </button>

          <button
            onClick={() => onChangeVaultTab('bookmarks')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeVaultTab === 'bookmarks'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-800'
            }`}
          >
            <BookmarkIcon className="w-4 h-4 text-amber-400" />
            <span>ที่บันทึกไว้ / บุ๊กมาร์ก ({bookmarksCount})</span>
          </button>

          <button
            onClick={() => onChangeVaultTab('recent')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeVaultTab === 'recent'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>ดูล่าสุด (Recently Viewed)</span>
          </button>

          <button
            onClick={() => onChangeVaultTab('trash')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeVaultTab === 'trash'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>ถังขยะ ({trashCount})</span>
          </button>

        </div>
      </div>

      {/* Secondary Controls: Folders & Status Workflow Filters (when on my_assets tab) */}
      {activeVaultTab === 'my_assets' && (
        <div className="space-y-3">
          
          {/* Folders Management Bar */}
          <div className="p-3 bg-white dark:bg-slate-850 rounded-2xl border border-purple-100 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2 px-1">
              <div className="flex items-center gap-2">
                <FolderIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  โฟลเดอร์จัดหมวดหมู่:
                </span>
              </div>

              <button
                onClick={onOpenFolderManager}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 flex items-center gap-1.5 px-2.5 py-1 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>จัดการโฟลเดอร์ ({folders.length})</span>
              </button>
            </div>

            {/* Horizontal Folder Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              
              {/* All Folder Button */}
              <button
                onClick={() => onSelectFolder('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedFolderId === 'all'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>📁 ผลงานทั้งหมด</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedFolderId === 'all' ? 'bg-purple-700 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  {totalAssetsCount}
                </span>
              </button>

              {/* Unassigned / Root Folder Button */}
              <button
                onClick={() => onSelectFolder('unassigned')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedFolderId === 'unassigned'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>🗃️ นอกโฟลเดอร์</span>
              </button>

              {/* User Folders */}
              {folders.map(f => {
                const isSelected = selectedFolderId === f.id;
                const colorMeta = FOLDER_COLOR_PRESETS.find(c => c.id === f.color) || FOLDER_COLOR_PRESETS[0];
                const folderIsImage = f.icon && (f.icon.startsWith('data:image') || f.icon.startsWith('http'));

                return (
                  <button
                    key={f.id}
                    onClick={() => onSelectFolder(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 border cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs'
                        : `${colorMeta.bg} ${colorMeta.text} ${colorMeta.border} hover:opacity-90`
                    }`}
                  >
                    {folderIsImage ? (
                      <img
                        src={f.icon}
                        alt={f.name}
                        className="w-4 h-4 rounded-md object-cover inline-block shrink-0 shadow-xs"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>{f.icon || '📁'}</span>
                    )}
                    <span>{f.name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isSelected ? 'bg-purple-700 text-white' : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200'
                    }`}>
                      {f.assetsCount || 0}
                    </span>
                  </button>
                );
              })}

              {/* Add Folder Quick Button */}
              <button
                onClick={onOpenFolderManager}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-dashed border-purple-300 dark:border-purple-800 whitespace-nowrap flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>สร้างโฟลเดอร์</span>
              </button>
            </div>
          </div>

          {/* Workflow Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar px-1">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span>สถานะ:</span>
            </span>

            <button
              onClick={() => onSelectStatusFilter('all')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                selectedStatusFilter === 'all'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-purple-300'
              }`}
            >
              ทั้งหมด
            </button>

            {(['idea', 'draft', 'in_progress', 'finished', 'archived'] as AssetStatus[]).map(st => {
              const meta = STATUS_PRESETS[st];
              const isSelected = selectedStatusFilter === st;
              return (
                <button
                  key={st}
                  onClick={() => onSelectStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 ${
                    isSelected
                      ? `${meta.bg} ${meta.text} ${meta.border} ring-2 ring-purple-300 dark:ring-purple-900`
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:opacity-80'
                  }`}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.name}</span>
                </button>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
};
