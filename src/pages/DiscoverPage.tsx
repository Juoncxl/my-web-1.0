import React from 'react';
import { AssetCollectionView } from '../components/AssetCollectionView';

interface DiscoverPageProps {
  collectionProps: React.ComponentProps<typeof AssetCollectionView>;
}

export const DiscoverPage: React.FC<DiscoverPageProps> = ({ collectionProps }) => (
  <AssetCollectionView {...collectionProps} />
);
