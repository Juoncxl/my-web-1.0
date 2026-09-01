import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import type { Asset } from '../types';
import { CATEGORIES } from '../lib/constants';
import { resolveWorkCreator } from '../lib/workPresentation';
import { AssetViewHeader } from './asset-view/AssetViewHeader';
import { AssetViewAttribution } from './asset-view/AssetViewAttribution';
import { AssetViewGallery } from './asset-view/AssetViewGallery';
import { AssetCopyType, AssetViewContentSection } from './asset-view/AssetViewContentSection';
import { AssetViewLinkedAssets } from './asset-view/AssetViewLinkedAssets';
import { AssetViewCodeSection, AssetViewTab } from './asset-view/AssetViewCodeSection';
import { AssetViewTags } from './asset-view/AssetViewTags';
import { AssetViewFooter } from './asset-view/AssetViewFooter';

export interface WorkDetailModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (asset: Asset) => void;
  onDelete?: (assetId: string) => void;
  onPermanentDelete?: (assetId: string) => void;
  onRestore?: (assetId: string) => void;
  onBookmark?: (assetId: string) => void;
  onFork?: (asset: Asset) => void;
  onReport?: (asset: Asset) => void;
  onSelectLinkedAsset?: (assetId: string) => void;
  allAssets?: Asset[];
  isOwner?: boolean;
  isBookmarked?: boolean;
  isTrashMode?: boolean;
  creatorProfile?: import('../types').User | null;
}

/** The one canonical Work presentation for both legacy and newly-created data. */
export const WorkDetailModal: React.FC<WorkDetailModalProps> = ({
  asset, isOpen, onClose, onEdit, onDelete, onPermanentDelete, onRestore,
  onBookmark, onFork, onReport, onSelectLinkedAsset, allAssets = [],
  isOwner = false, isBookmarked = false, isTrashMode = false, creatorProfile = null
}) => {
  const [copiedType, setCopiedType] = useState<AssetCopyType | null>(null);
  const [uiTab, setUiTab] = useState<AssetViewTab>('split');
  const [shareToast, setShareToast] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  if (!isOpen || !asset) return null;

  const creator = resolveWorkCreator(asset, creatorProfile);
  const galleryImages = asset.previewImages?.length ? asset.previewImages : (asset.previewImage ? [asset.previewImage] : []);
  const linkedAssets = (asset.linkedAssetIds || [])
    .map(id => allAssets.find(candidate => candidate.id === id))
    .filter((candidate): candidate is Asset => Boolean(candidate));
  const categoryMeta = CATEGORIES[asset.category] || CATEGORIES.character;

  const copyToClipboard = (text: string, type: AssetCopyType) => {
    void navigator.clipboard?.writeText(text);
    setCopiedType(type);
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.7 }, colors: ['#8B5CF6', '#EC4899', '#3B82F6'] });
    window.setTimeout(() => setCopiedType(null), 2500);
  };
  const handleShare = () => {
    void navigator.clipboard?.writeText(window.location.href);
    setShareToast(true);
    window.setTimeout(() => setShareToast(false), 2000);
  };
  const handleExportJSON = () => {
    const anchor = document.createElement('a');
    anchor.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(asset, null, 2))}`;
    anchor.download = `${asset.title.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}_vault.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  };
  const handleExportMarkdown = () => {
    const markdown = `# ${asset.title}\n**หมวดหมู่:** ${categoryMeta.name} (${categoryMeta.nameEn})\n**ผู้สร้าง:** ${creator.displayName}\n**วันที่สร้าง:** ${asset.createdAt}\n**ลิขสิทธิ์ / Proof Hash:** #VAULT-${asset.id.slice(0, 8).toUpperCase()}\n\n---\n\n## เนื้อหาหลัก\n${asset.content}\n${asset.uiCodeSnippet ? `\n---\n\n## โค้ด UI Snippet\n\`\`\`html\n${asset.uiCodeSnippet}\n\`\`\`` : ''}\n`;
    const anchor = document.createElement('a');
    anchor.href = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;
    anchor.download = `${asset.title.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}.md`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  };

  return <div data-work-detail-presentation="canonical" aria-label="Canonical Work Detail" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
    <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
      <AssetViewHeader asset={asset} isOwner={isOwner} isBookmarked={isBookmarked} shareToast={shareToast} onBookmark={onBookmark} onFork={onFork} onReport={onReport} onShare={handleShare} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <AssetViewAttribution asset={asset} showVersionHistory={showVersionHistory} onToggleVersionHistory={() => setShowVersionHistory(value => !value)} creatorProfile={creatorProfile} />
        <AssetViewGallery images={galleryImages} activeImageIdx={activeImageIdx} onSelectImage={setActiveImageIdx} />
        <AssetViewContentSection content={asset.content} copiedType={copiedType} onCopy={copyToClipboard} />
        <AssetViewLinkedAssets linkedAssets={linkedAssets} onSelectLinkedAsset={onSelectLinkedAsset} />
        <AssetViewCodeSection code={asset.uiCodeSnippet || ''} uiTab={uiTab} copiedType={copiedType} onTabChange={setUiTab} onCopy={copyToClipboard} />
        <AssetViewTags tags={asset.tags} />
      </div>
      <AssetViewFooter asset={asset} isOwner={isOwner} isTrashMode={isTrashMode} onExportMarkdown={handleExportMarkdown} onExportJSON={handleExportJSON} onRestore={onRestore} onPermanentDelete={onPermanentDelete} onEdit={onEdit} onDelete={onDelete} onClose={onClose} />
    </div>
  </div>;
};
