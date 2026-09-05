import React from 'react';
import { AssetCard } from '../AssetCard';
import { WorkDetailModal } from '../WorkDetailModal';
import type { Asset, Folder, User } from '../../types';
import type { CreatorReviewMode } from './creatorReviewModel';

export interface CreatorReviewPreviewProps {
  asset: Asset;
  mode: CreatorReviewMode;
  creatorProfile?: User | null;
  onOpenFullPreview: () => void;
  onClose?: () => void;
  embedded?: boolean;
  showFullButton?: boolean;
  allAssets?: Asset[];
  folders?: Folder[];
}

export const CreatorReviewPreview: React.FC<CreatorReviewPreviewProps> = ({ asset, mode, creatorProfile, onOpenFullPreview, onClose = () => undefined, embedded = true, showFullButton = true, allAssets = [], folders = [] }) => {
  const cardAsset = asset.previewImage ? asset : { ...asset, previewImage: '', previewImages: [] };
  return <div className={`csp-review-presentation csp-review-presentation-${mode}`}>
    {mode === 'card' ? <div className="csp-review-card-stage">
      <AssetCard asset={cardAsset} allAssets={allAssets} onClick={() => undefined} onLike={() => undefined} onBookmark={() => undefined} creatorProfile={creatorProfile} viewerMode="public" interactionMode="preview" />
    </div> : <WorkDetailModal asset={asset} allAssets={allAssets} folders={folders} isOpen onClose={onClose} creatorProfile={creatorProfile} embedded={embedded} coverImage={asset.previewImage} coverImageSelected={Boolean(asset.previewImage)} interactionMode="preview" />}
    {showFullButton && <button type="button" className="csp-review-full-button" onClick={onOpenFullPreview}>⛶ ดูเต็ม</button>}
  </div>;
};
