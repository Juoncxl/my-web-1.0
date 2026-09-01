import React from 'react';
import { AssetCollectionView } from '../components/AssetCollectionView';
import { PersonalVaultHeader } from '../components/PersonalVaultHeader';
import type { VaultTabType } from '../components/PersonalVaultHeader';
import type { Folder } from '../types';

interface VaultPageProps {
  collectionProps: React.ComponentProps<typeof AssetCollectionView>;
  totalAssetsCount: number;
  publicCount: number;
  privateCount: number;
  bookmarksCount: number;
  trashCount: number;
  folders: Folder[];
  activeVaultTab: VaultTabType;
  onChangeVaultTab: (tab: VaultTabType) => void;
  onOpenFolderManager: () => void;
  onOpenCreatorProfile: () => void;
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
  activeVaultTab,
  onChangeVaultTab,
  onOpenFolderManager,
  onOpenCreatorProfile,
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
      activeVaultTab={activeVaultTab}
      onChangeVaultTab={onChangeVaultTab}
      onOpenFolderManager={onOpenFolderManager}
      onOpenCreatorProfile={onOpenCreatorProfile}
      onCreateAsset={onCreateAsset}
    />
    <AssetCollectionView {...collectionProps} />
  </>
);
