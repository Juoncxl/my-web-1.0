import React from 'react';
import { AssetCollectionView } from '../components/AssetCollectionView';
import { CollabScheduleWidget } from '../components/CollabScheduleWidget';

interface DiscoverPageProps {
  collectionProps: React.ComponentProps<typeof AssetCollectionView>;
  onOpenSchedule?: () => void;
}

export const DiscoverPage: React.FC<DiscoverPageProps> = ({ collectionProps, onOpenSchedule }) => {
  const showSchedule = Boolean(onOpenSchedule) && collectionProps.activeView === 'feed'
    && ['all', 'collab'].includes(collectionProps.selectedCategory) && !collectionProps.searchQuery.trim();
  return <>
    {showSchedule && <CollabScheduleWidget assets={collectionProps.allAssets} onOpenSchedule={onOpenSchedule!} onOpenAsset={collectionProps.onOpenAsset} />}
    <AssetCollectionView {...collectionProps} />
  </>;
};
