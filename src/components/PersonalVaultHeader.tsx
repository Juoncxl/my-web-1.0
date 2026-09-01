import React from 'react';
import { useAuth } from '../context/AuthContext';
import type { Folder } from '../types';
import {
  Bookmark,
  Clock3,
  Folder as FolderIcon,
  Layers3,
  MoreHorizontal,
  Plus,
  Settings2,
  Trash2
} from 'lucide-react';

export type VaultTabType = 'my_assets' | 'folders' | 'bookmarks' | 'recent' | 'trash';

interface PersonalVaultHeaderProps {
  totalAssetsCount: number;
  publicCount: number;
  privateCount: number;
  bookmarksCount?: number;
  trashCount?: number;
  folders: Folder[];
  activeVaultTab: VaultTabType;
  onChangeVaultTab: (tab: VaultTabType) => void;
  onOpenFolderManager: () => void;
  onOpenCreatorProfile: () => void;
  onCreateAsset: () => void;
}

const primaryTabs: Array<{ id: Extract<VaultTabType, 'my_assets' | 'folders' | 'bookmarks'>; label: string; icon: typeof Layers3 }> = [
  { id: 'my_assets', label: 'ผลงาน', icon: Layers3 },
  { id: 'folders', label: 'โฟลเดอร์', icon: FolderIcon },
  { id: 'bookmarks', label: 'บันทึกไว้', icon: Bookmark }
];

export const PersonalVaultHeader: React.FC<PersonalVaultHeaderProps> = ({
  totalAssetsCount,
  publicCount,
  privateCount,
  bookmarksCount = 0,
  trashCount = 0,
  folders,
  activeVaultTab,
  onChangeVaultTab,
  onOpenFolderManager,
  onOpenCreatorProfile,
  onCreateAsset
}) => {
  const { currentUser } = useAuth();

  return (
    <section className="cv-vault-header" aria-labelledby="vault-title">
      <div className="cv-vault-intro">
        <div className="cv-vault-profile">
          <img
            src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
            alt=""
            className="cv-vault-avatar"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0">
            <h1 id="vault-title" className="cv-vault-title">คลังผลงาน</h1>
            <p className="cv-vault-description">
              {totalAssetsCount} ผลงาน · {publicCount} สาธารณะ · {privateCount} ส่วนตัว
            </p>
          </div>
        </div>

        <div className="cv-vault-intro-actions">
          <button type="button" onClick={onOpenCreatorProfile} className="cv-vault-profile-action" aria-label="เปิดโปรไฟล์ครีเอเตอร์" title="เปิดโปรไฟล์ครีเอเตอร์">
            <Settings2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onCreateAsset} className="cv-create-button cv-vault-create-action">
            <Plus className="h-4 w-4" />
            <span>สร้างผลงาน</span>
          </button>
        </div>
      </div>

      <nav className="cv-vault-navigation" aria-label="เมนูคลังผลงาน">
        <div className="cv-vault-primary-tabs">
          {primaryTabs.map(({ id, label, icon: Icon }) => {
            const count = id === 'my_assets' ? totalAssetsCount : id === 'bookmarks' ? bookmarksCount : folders.length;
            const isActive = activeVaultTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChangeVaultTab(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`cv-vault-tab ${isActive ? 'is-active' : ''}`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                <span className="cv-vault-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="cv-vault-utility-tabs" aria-label="เครื่องมือรอง">
          <button type="button" onClick={() => onChangeVaultTab('recent')} className={`cv-vault-utility-tab ${activeVaultTab === 'recent' ? 'is-active' : ''}`} aria-current={activeVaultTab === 'recent' ? 'page' : undefined}>
            <Clock3 className="h-3.5 w-3.5" />
            <span>ดูล่าสุด</span>
          </button>
          <button type="button" onClick={() => onChangeVaultTab('trash')} className={`cv-vault-utility-tab is-trash ${activeVaultTab === 'trash' ? 'is-active' : ''}`} aria-current={activeVaultTab === 'trash' ? 'page' : undefined}>
            <Trash2 className="h-3.5 w-3.5" />
            <span>ถังขยะ</span>
            {trashCount > 0 && <span className="cv-vault-utility-count">{trashCount}</span>}
          </button>
          <span className="cv-vault-more-hint" aria-hidden="true"><MoreHorizontal className="h-4 w-4" /></span>
        </div>
      </nav>
    </section>
  );
};
