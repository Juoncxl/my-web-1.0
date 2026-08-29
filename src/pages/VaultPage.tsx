import React from 'react';
import { AssetCollectionView } from '../components/AssetCollectionView';
import { PersonalVaultHeader } from '../components/PersonalVaultHeader';
import type { VaultTabType } from '../components/PersonalVaultHeader';
import type { AssetStatus, Folder } from '../types';

interface VaultPageProps {
  collectionProps: React.ComponentProps<typeof AssetCollectionView>;
  totalAssetsCount: number;
  publicCount: number;
  privateCount: number;
  bookmarksCount: number;
  trashCount: number;
  folders: Folder[];
  selectedFolderId: string | 'all' | 'unassigned';
  activeVaultTab: VaultTabType;
  selectedStatusFilter: AssetStatus | 'all';
  onSelectFolder: (folderId: string | 'all' | 'unassigned') => void;
  onChangeVaultTab: (tab: VaultTabType) => void;
  onSelectStatusFilter: (status: AssetStatus | 'all') => void;
  onOpenFolderManager: () => void;
  onEditProfile: () => void;
  onCreateAsset: () => void;
}

export const VaultPage: React.FC<VaultPageProps> = ({
  collectionProps,
  totalAssetsCount,
  publicCount,
  privateCount,
  bookmarksCount,
  trashCount,
  folders,
  selectedFolderId,
  activeVaultTab,
  selectedStatusFilter,
  onSelectFolder,
  onChangeVaultTab,
  onSelectStatusFilter,
  onOpenFolderManager,
  onEditProfile,
  onCreateAsset
}) => (
  <>
    <PersonalVaultHeader
      totalAssetsCount={totalAssetsCount}
      publicCount={publicCount}
      privateCount={privateCount}
      bookmarksCount={bookmarksCount}
      trashCount={trashCount}
      folders={folders}
      selectedFolderId={selectedFolderId}
      onSelectFolder={onSelectFolder}
      activeVaultTab={activeVaultTab}
      onChangeVaultTab={onChangeVaultTab}
      selectedStatusFilter={selectedStatusFilter}
      onSelectStatusFilter={onSelectStatusFilter}
      onOpenFolderManager={onOpenFolderManager}
      onEditProfile={onEditProfile}
      onCreateAsset={onCreateAsset}
    />
    <AssetCollectionView {...collectionProps} />
  </>
);
